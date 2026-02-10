require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Prediction = require('../src/app/lib/models/Prediction').default;

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGO_URI is not defined in .env");
  process.exit(1);
}

async function deleteToday() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().slice(0, 10);

    console.log(`Deleting prediction for date: ${today}`);
    const result = await Prediction.deleteOne({ date: today });
    
    console.log(`Deleted count: ${result.deletedCount}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

deleteToday();
