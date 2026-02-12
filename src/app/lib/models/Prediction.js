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
    }
  },
  { timestamps: true }
);

export default mongoose.models.Prediction || mongoose.model("Prediction", PredictionSchema);
