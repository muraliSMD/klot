import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";
import DrawHistory from "@/app/lib/models/DrawHistory";

const lastDigitOf = (ticket) => {
  const d = String(ticket || "").replace(/\D/g, "");
  return d ? Number(d[d.length - 1]) : null;
};

// Chi-square goodness-of-fit vs uniform 0-9 (df = 9). Critical value at p=0.05 is 16.92.
function uniformityTest(counts) {
  const n = counts.reduce((a, b) => a + b, 0);
  if (!n) return { chiSquare: 0, critical: 16.92, looksRandom: true };
  const exp = n / 10;
  const chi = counts.reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
  return { chiSquare: Number(chi.toFixed(2)), critical: 16.92, looksRandom: chi < 16.92 };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/klr/archive
 *   q        free text (ticket number / series / draw code)
 *   lottery  exact draw name
 *   from,to  YYYY-MM-DD inclusive
 *   digit    0-9, filter by last digit of 1st prize
 *   page, pageSize
 */
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const lottery = searchParams.get("lottery") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const digit = searchParams.get("digit");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(searchParams.get("pageSize") || "20", 10)));

    const filter = {};
    if (lottery) filter.draw_name = lottery;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ first_ticket: rx }, { draw_code: rx }, { draw_name: rx }, { date: rx }];
    }
    if (digit !== null && digit !== "" && /^\d$/.test(digit)) {
      filter.first_ticket = { $regex: `${digit}\\s*$` };
    }

    const [total, items, lotteries, allTickets, range] = await Promise.all([
      DrawHistory.countDocuments(filter),
      DrawHistory.find(filter, { raw: 0 })
        .sort({ date: -1, draw_name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      DrawHistory.distinct("draw_name"),
      DrawHistory.find(filter, { first_ticket: 1, _id: 0 }).lean(),
      DrawHistory.aggregate([{ $group: { _id: null, oldest: { $min: "$date" }, newest: { $max: "$date" }, count: { $sum: 1 } } }])
    ]);

    const counts = Array(10).fill(0);
    for (const t of allTickets) {
      const d = lastDigitOf(t.first_ticket);
      if (d !== null) counts[d]++;
    }

    return NextResponse.json({
      items: items.map(({ _id, __v, ...rest }) => ({ id: String(_id), ...rest, lastDigit: lastDigitOf(rest.first_ticket) })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      lotteries: lotteries.sort(),
      lastDigitCounts: counts,
      uniformity: uniformityTest(counts),
      archive: range[0] ? { oldest: range[0].oldest, newest: range[0].newest, count: range[0].count } : { count: 0 }
    });
  } catch (err) {
    console.error("Archive API error:", err);
    return NextResponse.json({ error: "Failed to load archive" }, { status: 500 });
  }
}
