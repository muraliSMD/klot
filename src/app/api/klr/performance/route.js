import { NextResponse } from "next/server";
import axios from "axios";
import dbConnect from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";

// External API source for history
const HISTORY_API_URL = "https://indialotteryapi.com/wp-json/klr/v1/history?limit=1000";

export async function GET() {
  try {
    await dbConnect();

    // 1. Fetch all predictions from local DB
    const predictions = await Prediction.find({}).sort({ date: -1 }).lean();

    // 2. Fetch official history from external API
    let historyItems = [];
    try {
      const { data } = await axios.get(HISTORY_API_URL);
      historyItems = data.items || [];
    } catch (apiError) {
      console.error("External History API Error:", apiError.message);
      // Continue even if external API fails, we just won't have winning numbers
    }

    // 3. Merge Data
    // Create a map of history by date for fast lookup
    const historyMap = historyItems.reduce((acc, item) => {
        // Standardize date format if necessary. Assuming both are YYYY-MM-DD or compatible
        const dateKey = item.draw_date || item.date; 
        if(dateKey) acc[dateKey] = item;
        return acc;
    }, {});

    const performanceData = predictions.map(pred => {
        const historyMatch = historyMap[pred.date];
        const winningNumber = historyMatch ? (historyMatch.first_ticket || historyMatch.firstprize) : null;
        
        let status = "Pending";
        let isWin = false;

        if (winningNumber) {
            // Check if winning number is in predicted numbers
            // We need to match exactly or maybe just the last 3/4 digits depending on game rules
            // Assuming exact match or suffix match for now based on typical usage
            // Prediction might be 3 digit or 4 digit. Winning is usually 6 digit.
            
            // Allow checking if any predicted number matches the ending of the winning number
            const winningSuffix = winningNumber.slice(-4); // Last 4 digits
            const winningSuffix3 = winningNumber.slice(-3); // Last 3 digits

            isWin = pred.predictedNumbers.some(p => {
                return winningNumber.endsWith(p) || p === winningSuffix || p === winningSuffix3;
            });

            status = isWin ? "Win" : "Loss";
        }

        return {
            _id: pred._id,
            date: pred.date,
            lotteryName: historyMatch?.draw_name || pred.lotteryName || "Unknown",
            predictedNumbers: pred.predictedNumbers,
            winningNumber: winningNumber || "Waiting...",
            status: status,
            isWin: isWin,
            algorithms: pred.algorithms || {}, // Include algorithms map
            threeDigit: pred.threeDigit || {}  // Include 3-digit logic if needed
        };
    });

    return NextResponse.json({ 
        results: performanceData,
        meta: {
            totalPredictions: predictions.length,
            wins: performanceData.filter(d => d.isWin).length
        }
    });

  } catch (err) {
    console.error("Performance API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
