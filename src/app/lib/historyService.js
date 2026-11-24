import connectDB from "@/app/lib/db";
import DrawHistory from "@/app/lib/models/DrawHistory";
import { fetchWithCache } from "@/app/lib/apiCache";

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

/**
 * Pull every draw the external API exposes (offset paging) and upsert into MongoDB.
 * Draws without a published 1st-prize ticket (e.g. today's pending draw) are skipped.
 */
export async function syncAllHistory({ pageSize = 100 } = {}) {
  await connectDB();
  const BASE_URL = process.env.KLR_API_BASE_URL || process.env.API || "https://indialotteryapi.com/wp-json/klr/v1";
  let offset = 0, total = Infinity, upserted = 0, skipped = 0;

  while (offset < total) {
    const res = await fetch(`${BASE_URL}/history?limit=${pageSize}&offset=${offset}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`History API responded ${res.status}`);
    const data = await res.json();
    const items = data.items || [];
    total = Number(data.total) || 0;
    if (items.length === 0) break;

    const ops = [];
    for (const it of items) {
      const date = it.draw_date || it.date;
      const draw_name = it.draw_name || it.name || "Kerala Draw";
      const first_ticket = extractWinningTicket(it);
      if (!date || !first_ticket) { skipped++; continue; }
      ops.push({
        updateOne: {
          filter: { date, draw_name },
          update: { $set: { date, draw_name, first_ticket, draw_code: it.draw_code || "", prizes: it.prizes || {}, raw: it } },
          upsert: true
        }
      });
    }
    if (ops.length) {
      await DrawHistory.bulkWrite(ops, { ordered: false });
      upserted += ops.length;
    }
    offset += items.length;
  }

  const stored = await DrawHistory.countDocuments();
  return { upserted, skipped, apiTotal: total === Infinity ? 0 : total, stored };
}

export async function syncAndGetHistory(limit = 300) {
  await connectDB();
  const BASE_URL = process.env.KLR_API_BASE_URL || process.env.API || "https://indialotteryapi.com/wp-json/klr/v1";

  let extData = null;
  try {
    extData = await fetchWithCache(`${BASE_URL}/history?limit=${limit}`, 5 * 60 * 1000);
  } catch (err) {
    console.warn("External API fetch error, utilizing MongoDB history fallback:", err.message);
  }

  const rawItems = Array.isArray(extData) ? extData : (extData?.items || extData?.results || []);

  if (rawItems.length > 0) {
    const processedItems = rawItems.map(it => ({
      ...it,
      name: it.draw_name || it.name || "Kerala Draw",
      draw_name: it.draw_name || it.name || "Kerala Draw",
      date: it.draw_date || it.date || "",
      draw_date: it.draw_date || it.date || "",
      first_ticket: extractWinningTicket(it) || it.first_ticket || it.firstprize || ""
    }));

    // Asynchronously save/update all draw records into MongoDB for offline resilience
    (async () => {
      try {
        const ops = processedItems
          .filter(item => item.date && item.first_ticket)
          .map(item => ({
            updateOne: {
              filter: { date: item.date, draw_name: item.draw_name },
              update: {
                $set: {
                  date: item.date,
                  draw_name: item.draw_name,
                  first_ticket: item.first_ticket,
                  draw_code: item.draw_code || "",
                  prizes: item.prizes || {},
                  raw: item
                }
              },
              upsert: true
            }
          }));

        if (ops.length > 0) {
          await DrawHistory.bulkWrite(ops, { ordered: false });
        }
      } catch (dbErr) {
        console.warn("DrawHistory DB Bulk Sync Warning:", dbErr.message);
      }
    })();

    return processedItems;
  }

  // Fallback: API unavailable -> Query local MongoDB database!
  const dbRecords = await DrawHistory.find({}).sort({ date: -1 }).limit(limit).lean();
  return dbRecords.map(it => ({
    draw_name: it.draw_name,
    name: it.draw_name,
    draw_date: it.date,
    date: it.date,
    first_ticket: it.first_ticket
  }));
}
