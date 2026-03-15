const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

// Define Schema Inline to avoid module issues
const PredictionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true },
    predictedNumbers: { type: [String], required: true },
    guessingBoard: { type: [String], required: false },
    algorithms: { type: Map, of: String, required: false },
    threeDigit: { type: Map, of: String, required: false },
    poolAnalysis: {
      sum: Number,
      zone: Number,
    hotStats: [[String]], 
      matrix: [String]
    },
    lotteryName: { type: String, required: false },
    yesterdayPrediction: {
        predictedNumbers: [String],
        guessingBoard: [String],
        algorithms: { type: Map, of: String },
        threeDigit: { type: Map, of: String },
        poolAnalysis: {
            sum: Number,
            zone: Number,
            hotStats: [[String]],
            matrix: [String]
        }
    }
  },
  { timestamps: true }
);

const Prediction = mongoose.models.Prediction || mongoose.model("Prediction", PredictionSchema);

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("Please define the MONGO_URI environment variable inside .env");
  process.exit(1);
}

async function resetPrediction() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.");

    // Calculate today in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().slice(0, 10);

    const total = await Prediction.countDocuments({});
    console.log(`Total predictions in DB: ${total}`);

    console.log(`Deleting prediction for date: ${today}`);
    const result = await Prediction.deleteMany({ date: today });
    console.log(`Deleted ${result.deletedCount} predictions.`);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

resetPrediction();
