import { NextResponse } from "next/server";
import { fetchWithCache } from "@/app/lib/apiCache";

const BASE_URL = process.env.KLR_API_BASE_URL || process.env.API || "https://indialotteryapi.com/wp-json/klr/v1";

function extractWinningTicket(item) {
  if (!item) return null;
  if (typeof item.first_ticket === "string" && item.first_ticket.trim()) return item.first_ticket.trim();
  if (item.first && typeof item.first === "object" && typeof item.first.ticket === "string" && item.first.ticket.trim()) {
    return item.first.ticket.trim();
  }
  if (typeof item.first === "string" && item.first.trim()) return item.first.trim();
  if (typeof item.firstprize === "string" && item.firstprize.trim()) return item.firstprize.trim();
  if (item.result && typeof item.result === "object") {
    const res = extractWinningTicket(item.result);
    if (res) return res;
  }
  if (typeof item.result === "string" && item.result.trim()) return item.result.trim();
  if (Array.isArray(item.mc) && item.mc.length > 0 && typeof item.mc[0] === "string") return item.mc[0].trim();
  return null;
}

export async function GET() {
  try {
    const data = await fetchWithCache(`${BASE_URL}/history?limit=300`, 5 * 60 * 1000);
    const rawItems = Array.isArray(data) ? data : (data?.items || []);
    const items = rawItems.map(it => ({
      ...it,
      name: it.draw_name || it.name,
      date: it.draw_date || it.date,
      first_ticket: extractWinningTicket(it) || it.first_ticket || it.firstprize
    }));
    return NextResponse.json({ ...data, items });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
