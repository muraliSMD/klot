require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const Prediction = require('../src/app/lib/models/Prediction').default;

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGO_URI is not defined in .env");
  process.exit(1);
}

async function analyze() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // 1. Get Today's Prediction
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().slice(0, 10);
    
    console.log(`📅 Analyzing Date: ${today}`);

    const prediction = await Prediction.findOne({ date: today }).lean();
    
    if (!prediction) {
        console.log("❌ No prediction found for today in DB.");
    } else {
        console.log("\n🔮 Today's Prediction (3-Digit):", prediction.threeDigit);
    }

    // 2. Get Official Result (History)
    const BASE_URL = "https://indialotteryapi.com/wp-json/klr/v1";
    console.log("\n📡 Fetching Official History...");
    
    const { data: historyData } = await axios.get(`${BASE_URL}/history?limit=50`);
    const list = Array.isArray(historyData) ? historyData : (historyData.items || []);
    
    // We need to find the specific lottery for today to get the *Previous* result
    // Assuming today is Wednesday -> DHANALEKSHMI (based on logged mappings)
    // But let's look at the *latest* draw in the list.
    
    // Filter for "DHANALEKSHMI" (if today is Wed) or just dump the last few to be sure.
    // Actually, let's just dump the top 3 items to see context.
    
    console.log("\n📜 Recent History (Top 3):");
    list.slice(0, 3).forEach((item, i) => {
        console.log(`   ${i}. ${item.draw_name} (${item.draw_date}): ${item.first_ticket}`);
    });

    // Let's identify the 'Previous' draw for today's lottery
    // If today is Wednesday, we look for DHANALEKSHMI.
    // The 'latest' might be today's result if it's already published?
    // User says result is 510. Let's see if that's in the list.
    
    const winner = list.find(it => it.first_ticket && it.first_ticket.endsWith('510'));
    if (winner) {
        console.log(`\n🏆 FOUND WINNER MATCH: ${winner.draw_name} - ${winner.first_ticket}`);
    } else {
        console.log("\n⚠️ Winner ending in 510 NOT found in API yet (maybe not updated).");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

analyze();
