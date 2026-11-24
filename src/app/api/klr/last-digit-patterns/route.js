import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { syncAllHistory } from "@/app/lib/historyService";

// Never cache: the report changes every time a scan runs.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const REPORT = path.resolve("python/data/last_digit_patterns.json");
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function run(script, timeoutMs = 180000) {
  const venv = path.resolve("venv/bin/python");
  const py = fs.existsSync(venv) ? venv : "python3";
  return new Promise((resolve, reject) => {
    const p = spawn(py, [path.resolve(script)], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`Scan timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Could not start Python (${py}): ${e.message}`));
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(err.trim().split("\n").slice(-3).join(" ") || `Python exited with code ${code}`));
    });
  });
}

function readReport() {
  if (!fs.existsSync(REPORT)) return null;
  const stat = fs.statSync(REPORT);
  return { ...JSON.parse(fs.readFileSync(REPORT, "utf8")), scanned_at: stat.mtime.toISOString() };
}

// GET: latest last-digit pattern report
export async function GET() {
  const report = readReport();
  if (!report) {
    return NextResponse.json({ available: false, message: "No pattern scan yet. Click 'Scan patterns'." }, { headers: NO_STORE });
  }
  return NextResponse.json({ available: true, ...report }, { headers: NO_STORE });
}

// POST: pull newest results into the DB, then re-scan all patterns
export async function POST() {
  const started = Date.now();
  let sync = null;
  try {
    sync = await syncAllHistory();
  } catch (err) {
    console.warn("Pre-scan history sync failed (continuing with stored data):", err.message);
  }
  try {
    await run("python/last_digit_patterns.py");
    const report = readReport();
    return NextResponse.json(
      { available: true, ...report, scan: { ok: true, ms: Date.now() - started, synced: sync } },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error("Pattern scan error:", err);
    return NextResponse.json({ available: false, error: "Pattern scan failed: " + err.message }, { status: 500, headers: NO_STORE });
  }
}
