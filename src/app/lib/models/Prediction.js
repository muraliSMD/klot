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
  },
  { timestamps: true }
);

export default mongoose.models.Prediction || mongoose.model("Prediction", PredictionSchema);
