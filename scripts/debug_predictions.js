require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Prediction = require('../src/app/lib/models/Prediction').default;

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGO_URI is not defined in .env");
  process.exit(1);
}

async function checkPredictions() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // 1. Check for today's prediction
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().slice(0, 10);

    console.log(`Checking for prediction on date: ${today}`);
    const todayPred = await Prediction.findOne({ date: today });
    
    if (todayPred) {
        console.log("✅ Found prediction for today:", JSON.stringify(todayPred, null, 2));
    } else {
        console.log("❌ No prediction found for today.");
    }

    // 2. Check latest prediction to see structure
    const latest = await Prediction.findOne({}).sort({ createdAt: -1 });
    if (latest) {
        console.log("ℹ️ Latest prediction:", JSON.stringify(latest, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkPredictions();
