import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(500, Number(searchParams.get("limit")) || 100));

    const extResp = await axios.get("https://indialotteryapi.com/wp-json/klr/v1/history");
    const extData = extResp.data;

    let items = [];
    if (Array.isArray(extData)) {
      items = extData;
    } else if (Array.isArray(extData.items)) {
      items = extData.items;
    } else if (extData && typeof extData === "object" && Array.isArray(extData.results)) {
      items = extData.results;
    } else {
      return NextResponse.json({
        ok: false,
        message: "Unexpected Kerala API response shape.",
        preview: JSON.stringify(extData).slice(0, 1000),
      }, { status: 500 });
    }

    items = items.slice(0, limit);

    const firstPrizes = items.map((it) => {
      if (!it || typeof it !== "object") return null;
      const possible =
        it.first_ticket ||
        it.first_ticket_number ||
        it.firstprize ||
        it.firstPrize ||
        (it.prizes && (it.prizes.mc?.[0] || it.prizes["1st"]?.[0])) ||
        (it.prizes && it.prizes["1st"]) ||
        it.mc ||
        "";
      if (!possible) return null;
      return String(possible).trim();
    }).filter(Boolean);

    const cleaned = firstPrizes.map(fp => fp.replace(/\D/g, "")).filter(s => s.length > 0);

    if (cleaned.length === 0) {
      return NextResponse.json({
        ok: true,
        freq: Array.from({length:10}, (_,i) => ({digit: i, count: 0})),
        totalDigits: 0,
        docs: firstPrizes.slice(0, 10),
      });
    }

    const freqCounts = Array.from({ length: 10 }, () => 0);
    let totalDigits = 0;
    for (const numStr of cleaned) {
      for (const ch of numStr) {
        const d = parseInt(ch, 10);
        if (!Number.isNaN(d)) {
          freqCounts[d] += 1;
          totalDigits += 1;
        }
      }
    }

    const freq = freqCounts.map((count, digit) => ({ digit, count }));

    return NextResponse.json({
      ok: true,
      freq,
      totalDigits,
      docs: cleaned,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
