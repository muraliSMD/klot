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
                  first_ticket: item.first_ticket
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
