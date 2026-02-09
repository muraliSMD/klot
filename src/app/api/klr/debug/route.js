import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";
import axios from "axios";

export async function GET() {
  try {
    await dbConnect();
    const latest = await Prediction.findOne().sort({ createdAt: -1 });
    
    // Also fetch history to see what the inputs would be
    const { data: historyData } = await axios.get("https://indialotteryapi.com/wp-json/klr/v1/history?limit=10");
    const fullList = Array.isArray(historyData) ? historyData : (historyData.items || []);
    
    return NextResponse.json({
        latestRecord: latest,
        debugInputs: {
            firstDraw: fullList[0],
            secondDraw: fullList[1]
        }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
