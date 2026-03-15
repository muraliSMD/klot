require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Prediction = require('../src/app/lib/models/Prediction').default;

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGO_URI is not defined in .env");
  process.exit(1);
}

async function check3Digit() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const latest = await Prediction.findOne({}).sort({ createdAt: -1 });
    
    if (latest) {
        console.log("--- Latest Prediction ---");
        console.log("Date:", latest.date);
        console.log("Algorithms:", JSON.stringify(latest.algorithms, null, 2));
        console.log("Three Digit:", JSON.stringify(latest.threeDigit, null, 2)); // This is the key check
    } else {
        console.log("❌ No prediction found.");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

check3Digit();
