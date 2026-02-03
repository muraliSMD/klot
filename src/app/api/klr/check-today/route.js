import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";

export async function GET() {
  try {
    await dbConnect();
    const today = new Date().toISOString().slice(0, 10);
    let existing = await Prediction.findOne({ date: today });
    if (!existing) {
      // Fallback: get the latest overall prediction (useful for "Tomorrow's" predictions)
      existing = await Prediction.findOne().sort({ date: -1 });
    }
    return NextResponse.json({ exists: !!existing, data: existing });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
