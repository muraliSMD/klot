require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Prediction = require('../src/app/lib/models/Prediction').default;

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGO_URI is not defined in .env");
  process.exit(1);
}

async function checkDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Get today's date in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().slice(0, 10);
    
    console.log(`Checking Prediction for Date: ${today}`);

    const prediction = await Prediction.findOne({ date: today }).lean();

    if (prediction) {
        console.log("\n--- Prediction Data ---");
        console.log("3-Digit Keys found:", Object.keys(prediction.threeDigit || {}));
        console.log("3-Digit Value:", prediction.threeDigit);
    } else {
        console.log("❌ No prediction found for today.");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkDB();
