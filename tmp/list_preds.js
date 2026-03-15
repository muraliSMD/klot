require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Prediction = require('../src/app/lib/models/Prediction').default;

const MONGODB_URI = process.env.MONGO_URI;

async function check() {
  try {
    await mongoose.connect(MONGODB_URI);
    const predictions = await Prediction.find().sort({ date: -1 }).limit(5).lean();
    predictions.forEach(p => {
        console.log(`Date: ${p.date}, AI Pred: ${p.aiPrediction ? 'YES' : 'NO'}`);
        if (p.aiPrediction) console.log(JSON.stringify(p.aiPrediction, null, 2));
    });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
