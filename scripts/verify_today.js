require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Prediction = require('../src/app/lib/models/Prediction').default;

// Mock the analysis/generation logic here since we can't easily import the full Next.js API route logic
// OR better, try to call the API route locally if possible, but that requires a running server.
// Instead, let's just check the DB one more time cleanly.

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}

async function checkAndFix() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ DB Connected");

    const today = new Date().toISOString().slice(0, 10); // Standard UTC date for simplicity check first
    // Adjust for IST if needed
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const todayIST = istDate.toISOString().slice(0, 10);
    
    console.log(`Checking Date (UTC): ${today}`);
    console.log(`Checking Date (IST): ${todayIST}`);

    const predIST = await Prediction.findOne({ date: todayIST });
    
    if (predIST) {
        console.log("✅ FOUND Prediction for today (IST)!");
        console.log("ID:", predIST._id);
        console.log("Numbers:", predIST.predictedNumbers);
        console.log("Algorithms:", predIST.algorithms);
    } else {
        console.log("❌ NO Prediction found for today (IST).");
        
        // Check latest 3
        const latest = await Prediction.find({}).sort({ date: -1 }).limit(3);
        console.log("--- Latest 3 Predictions ---");
        latest.forEach(p => console.log(`${p.date}: ${p.predictedNumbers.length} nums`));
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkAndFix();
