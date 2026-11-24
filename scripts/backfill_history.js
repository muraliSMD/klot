// Backfill ALL available draw history from the external API into MongoDB.
// Safe to run repeatedly (upserts on date + draw_name). Run: node scripts/backfill_history.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGO_URI;
const BASE_URL = process.env.KLR_API_BASE_URL || process.env.API || 'https://indialotteryapi.com/wp-json/klr/v1';
const PAGE = 100;

if (!MONGODB_URI) {
  console.error('❌ MONGO_URI is not defined');
  process.exit(1);
}

// Mirrors src/app/lib/models/DrawHistory.js (same "drawhistories" collection)
const DrawHistory = mongoose.models.DrawHistory || mongoose.model('DrawHistory', new mongoose.Schema({
  date: { type: String, required: true, index: true },
  draw_name: { type: String, required: true },
  first_ticket: { type: String, required: true },
  draw_code: { type: String, default: '' },
  prizes: { type: mongoose.Schema.Types.Mixed, default: {} },
  raw: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true }));

function ticketOf(it) {
  const t = it.first_ticket || it.first?.ticket || it.firstprize || (Array.isArray(it.mc) ? it.mc[0] : '');
  return typeof t === 'string' ? t.trim() : '';
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ DB Connected');

  let offset = 0, total = Infinity, saved = 0, skipped = 0;
  while (offset < total) {
    const res = await fetch(`${BASE_URL}/history?limit=${PAGE}&offset=${offset}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const items = data.items || [];
    total = Number(data.total) || 0;
    if (items.length === 0) break;

    const ops = [];
    for (const it of items) {
      const date = it.draw_date || it.date;
      const draw_name = it.draw_name || it.name || 'Kerala Draw';
      const first_ticket = ticketOf(it);
      if (!date || !first_ticket) { skipped++; continue; } // e.g. today's draw not yet published
      ops.push({
        updateOne: {
          filter: { date, draw_name },
          update: { $set: { date, draw_name, first_ticket, draw_code: it.draw_code || '', prizes: it.prizes || {}, raw: it } },
          upsert: true
        }
      });
    }
    if (ops.length) {
      await DrawHistory.bulkWrite(ops, { ordered: false });
      saved += ops.length;
    }
    console.log(`  offset ${offset}: ${items.length} fetched`);
    offset += items.length;
  }

  const count = await DrawHistory.countDocuments();
  const oldest = await DrawHistory.findOne().sort({ date: 1 }).lean();
  console.log(`✅ Upserted ${saved}, skipped ${skipped} (no result yet)`);
  console.log(`📦 DB now holds ${count} draws, oldest: ${oldest?.date}`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
