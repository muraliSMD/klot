import mongoose from "mongoose";

const PredictionSchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      unique: true,
    },
    predictedNumbers: {
      type: [String], // Store as strings to handle codes if needed
      required: true,
    },
    topFive: {
      type: [String], // Top 5 winning picks
      required: false,
    },
    guessingBoard: {
      type: [String], // Store 4-digit permutations
      required: false,
    },
    algorithms: {
      type: Map,
      of: String,
      required: false, // Optional for backward compatibility
    },
    threeDigit: {
      type: mongoose.Schema.Types.Mixed, // Use Mixed type to store any object structure
      required: false
    },
    poolAnalysis: {
      sum: Number,
      zone: Number,
      hotStats: [[String]], // Array of arrays of strings
      matrix: [String]
    },
    lotteryName: {
      type: String,
      required: false,
    },
    yesterdayPrediction: {
        predictedNumbers: [String],
        topFive: [String],
        guessingBoard: [String],
        algorithms: {
            type: Map,
            of: String
        },
        threeDigit: {
            type: mongoose.Schema.Types.Mixed,
            required: false
        },
        poolAnalysis: {
            sum: Number,
            zone: Number,
            hotStats: [[String]],
            matrix: [String]
        }
    },
    // Verification Fields
    result: {
        type: String, // Actual winning number (e.g., "123")
        required: false
    },
    outcome: {
        isDirectHit: { type: Boolean, default: false },
        isBoxHit: { type: Boolean, default: false }, // Permutation match
        winningAlgos: [String], // List of algo keys that predicted the winner
        matchedNumber: String // The number that matched (if any)
    },
    aiPrediction: {
        predictedNumber: String,
        targetDate: String,
        confidence: Number,
        features: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

export default mongoose.models.Prediction || mongoose.model("Prediction", PredictionSchema);
