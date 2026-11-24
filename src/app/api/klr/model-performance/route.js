import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const REPORT = path.resolve("python/data/last_digit_backtest.json");

function pythonExec() {
  const venv = path.resolve("venv/bin/python");
  return fs.existsSync(venv) ? venv : "python3";
}

function run(script) {
  return new Promise((resolve, reject) => {
    const p = spawn(pythonExec(), [path.resolve(script)], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-500) || `exit ${code}`))));
  });
}

// GET: latest saved last-digit backtest report
export async function GET() {
  if (!fs.existsSync(REPORT)) {
    return NextResponse.json({ available: false, message: "No backtest yet. Click 'Re-run backtest'." });
  }
  return NextResponse.json({ available: true, ...JSON.parse(fs.readFileSync(REPORT, "utf8")) });
}

// POST: refresh data from DB, then re-run the honest backtest (takes ~10-30s)
export async function POST() {
  try {
    await run("python/fetch_data.py");
    await run("python/backtest_last_digit.py");
    return GET();
  } catch (err) {
    console.error("Model performance backtest error:", err);
    return NextResponse.json({ available: false, error: "Backtest failed: " + err.message }, { status: 500 });
  }
}
