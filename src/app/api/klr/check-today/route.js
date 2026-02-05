import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/db";
import axios from "axios";
import Prediction from "@/app/lib/models/Prediction";

export async function GET() {
  try {
    await dbConnect();
    const today = new Date().toISOString().slice(0, 10);
    let existing = await Prediction.findOne({ date: today });
    
    // Always fetch history to calculate/return the current trend
    const BASE_URL = "https://indialotteryapi.com/wp-json/klr/v1";
    let trend = [];
    
    // Fetch History
    try {
        const { data: historyData } = await axios.get(`${BASE_URL}/history?limit=5`);
        const list = Array.isArray(historyData) ? historyData : (historyData.items || []);
        const latestDraw = list[0]; 
        const previousDraw = list[1];

        if (latestDraw && latestDraw.first_ticket) {
            const winningNumber = latestDraw.first_ticket; 
            const numericPart = winningNumber.replace(/\D/g, ''); 
            
            // Default trend
            trend = numericPart.split('').map(() => 1);

            if (previousDraw && previousDraw.first_ticket) {
                const prevNumeric = previousDraw.first_ticket.replace(/\D/g, '');
                if (prevNumeric.length === numericPart.length) {
                    trend = numericPart.split('').map((d, i) => {
                        const currDigit = parseInt(d);
                        const prevDigit = parseInt(prevNumeric[i]);
                        return (currDigit - prevDigit + 10) % 10;
                    });
                }
            }

            // If no prediction exists for today, generate one using multiple algorithms
            if (!existing) {
                // helper to apply a shift
                const applyShift = (numStr, shiftArr) => {
                    return numStr.split('').map((d, i) => {
                        return (parseInt(d) + shiftArr[i]) % 10;
                    }).join('');
                };

                // 1. Algo: Linear Trend (Current)
                const algoLinear = applyShift(numericPart, trend);

                // 2. Algo: Average Velocity (Smoothed)
                let velocityTrend = [...trend];
                if (list[2] && list[2].first_ticket) {
                     // Calculate trend between Draw 3 and Draw 2
                     const d2 = list[1].first_ticket.replace(/\D/g, '');
                     const d3 = list[2].first_ticket.replace(/\D/g, '');
                     if (d2.length === d3.length) {
                         const trend2 = d2.split('').map((d, i) => (parseInt(d) - parseInt(d3[i]) + 10) % 10);
                         // Average the trends: (t1 + t2) / 2 (rounded)
                         velocityTrend = trend.map((t, i) => Math.round((t + trend2[i]) / 2));
                     }
                }
                const algoVelocity = applyShift(numericPart, velocityTrend);

                // 3. Algo: Mirror (Flip Linear result)
                // 0->5, 1->6, etc. (Add 5 mod 10)
                const algoMirror = algoLinear.split('').map(d => (parseInt(d) + 5) % 10).join('');

                // 4. Algo: Date Flow
                // Add current day of month to the Linear result
                const dayOfMonth = new Date().getDate();
                const algoDate = algoLinear.split('').map(d => (parseInt(d) + dayOfMonth) % 10).join('');

                const p1 = algoLinear; 
                // Legacy support for array
                const p2 = algoVelocity;
                const p3 = algoMirror;

                existing = await Prediction.create({
                    date: today,
                    predictedNumbers: [p1, p2, p3],
                    guessingBoard: [p1.slice(0,4), p2.slice(0,4), p3.slice(0,4)],
                    algorithms: {
                        "Linear Trend": algoLinear,
                        "Average Velocity": algoVelocity,
                        "Mirror Pattern": algoMirror,
                        "Date Flow": algoDate
                    }
                });
            }
        }
    } catch (e) {
        console.error("Failed to fetch history for trend:", e.message);
    }
    
    if (!existing) {
        // Fallback if prediction generation failed
        existing = await Prediction.findOne().sort({ date: -1 });
    }

    return NextResponse.json({ exists: !!existing, data: existing, trend });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
