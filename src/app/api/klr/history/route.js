import { NextResponse } from "next/server";
import { syncAndGetHistory } from "@/app/lib/historyService";

export async function GET() {
  try {
    const items = await syncAndGetHistory(300);
    return NextResponse.json({ items, count: items.length });
  } catch (err) {
    console.error("History API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
