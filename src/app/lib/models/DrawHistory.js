import mongoose from "mongoose";

const DrawHistorySchema = new mongoose.Schema(
  {
    date: {
      type: String, // e.g., "YYYY-MM-DD" or "DD.MM.YYYY"
      required: true,
      index: true
    },
    draw_name: {
      type: String,
      required: true
    },
    first_ticket: {
      type: String, // Winning 1st prize ticket (e.g. "SS 123456" or "123456")
      required: true
    },
    draw_code: { type: String, default: "" }, // e.g. "KR-772"
    prizes: { type: mongoose.Schema.Types.Mixed, default: {} }, // all prize tiers + amounts
    raw: { type: mongoose.Schema.Types.Mixed, default: {} } // original API payload for reference
  },
  { timestamps: true }
);

DrawHistorySchema.index({ date: 1, draw_name: 1 }, { unique: true });

export default mongoose.models.DrawHistory || mongoose.model("DrawHistory", DrawHistorySchema);
