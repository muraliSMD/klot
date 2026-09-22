import { NextResponse } from "next/server";
import { fetchWithCache } from "@/app/lib/apiCache";

const BASE_URL = "https://indialotteryapi.com/wp-json/klr/v1";

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
    // Current IST Time (+5:30)
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs);
    
    const dStr = String(istDate.getUTCDate()).padStart(2, '0');
    const mStr = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const yStr = String(istDate.getUTCFullYear());

    const todayISO = `${yStr}-${mStr}-${dStr}`; // YYYY-MM-DD
    const possibleTodayDates = [
      `${yStr}-${mStr}-${dStr}`,
      `${dStr}.${mStr}.${yStr}`,
      `${dStr}/${mStr}/${yStr}`,
      `${dStr}-${mStr}-${yStr}`
    ];

    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const lotteryMapping = {
      'Sunday': 'SAMRUDHI',
      'Monday': 'BHAGYATHARA',
      'Tuesday': 'STHREE SAKTHI',
      'Wednesday': 'DHANALEKSHMI',
      'Thursday': 'KARUNYA PLUS',
      'Friday': 'SUVARNA KERALAM',
      'Saturday': 'KARUNYA'
    };
    const todayDayName = weekdayNames[istDate.getUTCDay()];
    const todayLotteryName = lotteryMapping[todayDayName];

    // Calculate Tomorrow's Date & Lottery Name
    const tomorrowIST = new Date(istDate.getTime() + 24 * 60 * 60 * 1000);
    const tomDStr = String(tomorrowIST.getUTCDate()).padStart(2, '0');
    const tomMStr = String(tomorrowIST.getUTCMonth() + 1).padStart(2, '0');
    const tomYStr = String(tomorrowIST.getUTCFullYear());
    const tomorrowISO = `${tomYStr}-${tomMStr}-${tomDStr}`;
    const tomorrowDayName = weekdayNames[tomorrowIST.getUTCDay()];
    const tomorrowLotteryName = lotteryMapping[tomorrowDayName];

    // Fetch latest and recent history concurrently using high-speed server cache
    const [latestData, historyData] = await Promise.all([
      fetchWithCache(`${BASE_URL}/latest`, 2 * 60 * 1000).catch(() => null),
      fetchWithCache(`${BASE_URL}/history?limit=30`, 5 * 60 * 1000).catch(() => [])
    ]);

    const latestSingle = Array.isArray(latestData) ? latestData[0] : latestData;
    const historyList = Array.isArray(historyData) ? historyData : (historyData?.items || []);

    const allItems = [latestSingle, ...historyList].filter(Boolean);

    let todayItem = null;
    let previousItem = allItems[0] || null;

    // Match today's official drawn result across all items
    for (const item of allItems) {
      const itemDate = String(item.date || item.draw_date || "");
      const itemName = String(item.draw_name || item.name || "");

      const matchesDate = possibleTodayDates.some(pd => itemDate.includes(pd) || itemName.includes(pd));
      if (matchesDate) {
        todayItem = item;
        break;
      }
    }

    const isTodayReleased = !!todayItem;
    const todayWinningTicket = isTodayReleased ? extractWinningTicket(todayItem) : null;
    const previousWinningTicket = previousItem ? extractWinningTicket(previousItem) : null;

    // Target Draw Release Timestamps for 3:30 PM IST (15:30 IST)
    const istHours = istDate.getUTCHours();
    const istMinutes = istDate.getUTCMinutes();
    
    // Today 3:30 PM IST
    const todayTargetIST = new Date(istDate);
    todayTargetIST.setUTCHours(15, 30, 0, 0);

    // Tomorrow 3:30 PM IST
    const tomorrowTargetIST = new Date(tomorrowIST);
    tomorrowTargetIST.setUTCHours(15, 30, 0, 0);

    // Active Target Timestamp: if today is released or past 3:30 PM IST, target tomorrow 3:30 PM IST
    let activeTargetIST = todayTargetIST;
    if ((istHours > 15 || (istHours === 15 && istMinutes >= 30)) || isTodayReleased) {
      activeTargetIST = tomorrowTargetIST;
    }

    const targetTimestamp = activeTargetIST.getTime() - istOffsetMs;
    const tomorrowTargetTimestamp = tomorrowTargetIST.getTime() - istOffsetMs;

    return NextResponse.json({
      todayDate: todayISO,
      todayFormatted: `${dStr}.${mStr}.${yStr}`,
      todayLottery: todayLotteryName,
      isTodayReleased: isTodayReleased,
      releaseTimeIST: "3:30 PM IST",
      targetTimestamp: targetTimestamp,
      first_ticket: todayWinningTicket,
      draw_name: isTodayReleased ? (todayItem?.draw_name || todayItem?.name || todayLotteryName) : todayLotteryName,
      prize_amount: isTodayReleased ? (todayItem?.prize_amount || todayItem?.firstprize || "₹1,00,00,000 (1 Crore)") : "₹1,00,00,000 (1 Crore)",
      
      // Tomorrow Info
      tomorrowDate: tomorrowISO,
      tomorrowFormatted: `${tomDStr}.${tomMStr}.${tomYStr}`,
      tomorrowLottery: tomorrowLotteryName,
      tomorrowTargetTimestamp: tomorrowTargetTimestamp,

      previousDraw: previousItem ? {
        first_ticket: previousWinningTicket,
        draw_name: previousItem.draw_name || previousItem.name,
        date: previousItem.date || previousItem.draw_date
      } : null,
      result: todayItem || previousItem,
      status: isTodayReleased ? "TODAY_OFFICIAL_RELEASED" : "DRAW_PENDING_330PM_IST"
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
