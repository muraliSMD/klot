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

    const p = await Prediction.findOne({ date: today }).lean();
    if (p) {
        console.log(`Date: ${p.date}`);
        console.log(`Top Numbers Count: ${p.topFive.length}`);
        console.log(`Top Numbers: ${p.topFive.join(', ')}`);
        if (p.yesterdayPrediction) {
            console.log(`Yesterday Top Numbers Count: ${p.yesterdayPrediction.topFive.length}`);
            console.log(`Yesterday Top Numbers: ${p.yesterdayPrediction.topFive.join(', ')}`);
        }
    } else {
        console.log("No prediction found for today.");
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
