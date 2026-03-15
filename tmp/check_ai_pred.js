require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Prediction = require('../src/app/lib/models/Prediction').default;

const MONGODB_URI = process.env.MONGO_URI;

async function check() {
  try {
    await mongoose.connect(MONGODB_URI);
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().slice(0, 10);
    
    const prediction = await Prediction.findOne({ date: today }).lean();
    if (prediction && prediction.aiPrediction) {
        console.log("✅ AI Prediction Found:", JSON.stringify(prediction.aiPrediction, null, 2));
    } else {
        console.log("❌ AI Prediction field missing or empty");
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
