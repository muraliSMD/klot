import mongoose from "mongoose";

const AlgorithmStatsSchema = new mongoose.Schema(
  {
    algoKey: {
      type: String,
      required: true,
      unique: true, // e.g., "algo9", "algo3D_12"
    },
    hits: {
      type: Number,
      default: 0,
    },
    totalRuns: {
      type: Number,
      default: 0,
    },
    lastHitDate: {
      type: Date,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    // metrics: Win Rate = hits / totalRuns
  },
  { timestamps: true }
);

export default mongoose.models.AlgorithmStats || mongoose.model("AlgorithmStats", AlgorithmStatsSchema);
