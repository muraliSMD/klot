import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { syncAllHistory } from "@/app/lib/historyService";

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${cronSecret}` || request.headers.get("x-vercel-cron") === "1") return true;
  try {
    // Logged-in dashboard users can trigger a manual sync
    jwt.verify(auth.replace(/^Bearer\s+/, ""), process.env.JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// Daily job: copy every draw from the external API into MongoDB so the archive never loses records.
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncAllHistory();
    return NextResponse.json({ success: true, syncedAt: new Date().toISOString(), ...result });
  } catch (err) {
    console.error("History sync cron error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
