import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/db";
import axios from "axios";
import Prediction from "@/app/lib/models/Prediction";

export async function GET() {
  try {
    await dbConnect();
    
    // Time Restriction Logic: Predictions are disabled after 1:00 PM (13:00) IST
    const now = new Date();
    // Convert current UTC time to IST (+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const istHours = istDate.getUTCHours();
    const istMinutes = istDate.getUTCMinutes();

    // Predictions only allowed between 11:00 AM and 1:00 PM IST
    const today = istDate.toISOString().slice(0, 10);
    // Use lean() to get a plain JavaScript object, avoiding schema versioning issues during hot reload
    let existing = await Prediction.findOne({ date: today }).lean();
    
    // Always fetch history to calculate/return the current trend
    const BASE_URL = "https://indialotteryapi.com/wp-json/klr/v1";
    let trend = [];
    
    // Time Restriction Logic: Predictions are disabled after 1:00 PM (13:00) IST
    // BUT if a prediction ALREADY EXISTS, we show it regardless of time.
    if (!existing) {
        if (istHours >= 13 || istHours < 11) {
          return NextResponse.json({ 
            disabled: true, 
            message: "Predictions are only available between 11:00 AM and 1:00 PM IST." 
          });
        }
    }
    
    let targetLottery = "";
    let dayOfWeek = "";
    
    // Fetch History
    try {
        // Increase limit to 1000 to find enough matches for specific lottery series
        const { data: historyData } = await axios.get(`${BASE_URL}/history?limit=1000`);
        const fullList = Array.isArray(historyData) ? historyData : (historyData.items || []);

        // Determine today's lottery name based on IST day of week
        const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const istDay = istDate.getUTCDay(); // istDate is already calculated at start of GET
        dayOfWeek = weekdayNames[istDay];

        const lotteryMapping = {
            'Sunday': 'SAMRUDHI',
            'Monday': 'BHAGYATHARA',
            'Tuesday': 'STHREE SAKTHI',
            'Wednesday': 'DHANALEKSHMI',
            'Thursday': 'KARUNYA PLUS',
            'Friday': 'SUVARNA KERALAM',
            'Saturday': 'KARUNYA'
        };

        targetLottery = lotteryMapping[dayOfWeek];

        // Filter list for the specific lottery series
        const list = fullList.filter(it => 
            it.draw_name && 
            it.draw_name.toUpperCase().startsWith(targetLottery)
        );

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

            // (Auto-generation logic removed to enforce manual trigger)
            // The patching logic below will now only run if 'existing' was found at the top of the file

            
                // REPAIR/PATCH: Backfill missing fields or keys
                // Check if we need to patch: missing entire object, or missing new keys (e.g., Symmetric Drift)
                const needsPatch = !existing.threeDigit || 
                                   !existing.threeDigit["Repeat Middle"] || 
                                   !existing.threeDigit["Symmetric Drift"];

                if (existing && (needsPatch || !existing.yesterdayPrediction)) {
                     const generateFromList = (drawList, dateObj) => {
                        if (!drawList || drawList.length < 2) return null;
                        const latestDraw = drawList[0]; 
                        const previousDraw = drawList[1];
                        if (!latestDraw || !latestDraw.first_ticket) return null;
                        const winningNumber = latestDraw.first_ticket; 
                        const numericPart = winningNumber.replace(/\D/g, ''); 
                        let trend = numericPart.split('').map(() => 1);
                        if (previousDraw && previousDraw.first_ticket) {
                            const prevNumeric = previousDraw.first_ticket.replace(/\D/g, '');
                            if (prevNumeric.length === numericPart.length) {
                                trend = numericPart.split('').map((d, i) => (parseInt(d) - parseInt(prevNumeric[i]) + 10) % 10);
                            }
                        }
                        const applyShift = (numStr, shiftArr) => {
                            return numStr.split('').map((d, i) => (parseInt(d) + shiftArr[i]) % 10).join('');
                        };
                        const algo1 = applyShift(numericPart, trend);
                        let velocityTrend = [...trend];
                        if (drawList[2] && drawList[2].first_ticket) {
                            const d2 = drawList[1].first_ticket.replace(/\D/g, '');
                            const d3 = drawList[2].first_ticket.replace(/\D/g, '');
                            if (d2.length === d3.length) {
                                const trend2 = d2.split('').map((d, i) => (parseInt(d) - parseInt(d3[i]) + 10) % 10);
                                velocityTrend = trend.map((t, i) => Math.round((t + trend2[i]) / 2));
                            }
                        }
                        const algo2 = applyShift(numericPart, velocityTrend);
                        const algo3 = algo1.split('').map(d => (parseInt(d) + 5) % 10).join('');
                        const dayOfMonth = dateObj.getUTCDate();
                        const algo4 = algo1.split('').map(d => (parseInt(d) + dayOfMonth) % 10).join('');
                        
                        // 5. Algo: Delta Pattern-A
                        const deltaPattern = [3, 0, 4, 9, 4, 6];
                        const algo5 = applyShift(numericPart, deltaPattern);

                        // --- 3-Digit Specific Algorithms ---
                        const last3 = numericPart.slice(-3);
                        // Convert to digits array for new algos
                        const digitArray = last3.split('').map(d => parseInt(d));
                        // Need trend for last 3 digits
                        const trendLast3 = trend.slice(-3);

                        const algo3D_1 = last3; // Direct
                        const algo3D_2 = last3.split('').reverse().join(''); // Reverse
                        const complement = (1000 - parseInt(last3)).toString().padStart(3, '0');
                        const algo3D_3 = complement.slice(-3); // Complement
                        const algo3D_4 = last3.split('').map(d => (parseInt(d) + 1) % 10).join(''); // Shift +1
                        const algo3D_5 = last3.split('').map(d => (parseInt(d) + 9) % 10).join(''); // Shift -1
                        
                        // New Algos (Mirror, Key, Flow, Crossing) - Re-implementing logic here to match generate-prediction
                        const algo3D_6 = last3.split('').map(d => (parseInt(d)+5)%10).join(''); // Mirror
                        const algo3D_7 = last3.split('').map(d => (parseInt(d)+2)%10).join(''); // Key
                        const algo3D_8 = (drawList.length > 0 ? getPositionalHotness(drawList)[0][0] : ((digitArray[0]+5)%10)) + last3.slice(1); // Flow
                        const algo3D_9 = last3.slice(-1) + last3.slice(0, 2); // Crossing
                        
                        // Vertical Locks
                        const d1_trend = (digitArray[0] + trendLast3[0]) % 10;
                        const d2_repeat = digitArray[1]; 
                        const d3_trend = (digitArray[2] + trendLast3[2]) % 10;
                        const algo3D_10 = `${d1_trend}${d2_repeat}${d3_trend}`; // Repeat Middle

                        const d1_trend_last = (digitArray[0] + trendLast3[0]) % 10;
                        const d2_trend_last = (digitArray[1] + trendLast3[1]) % 10;
                        const d3_repeat_last = digitArray[2]; 
                        const algo3D_11 = `${d1_trend_last}${d2_trend_last}${d3_repeat_last}`; // Repeat Last

                        // Advanced Algos
                        const algo3D_12 = digitArray.map((d, i) => {
                            if (i === 1) return d; 
                            return (d - 2 + 10) % 10; 
                        }).join(''); // Symmetric Drift

                        const algo3D_13 = digitArray.map(d => 9 - d).join(''); // 9-Complement

                        return {
                            predictedNumbers: [algo1, algo2, algo3, algo4, algo5],
                            algorithms: {
                                "Linear Trend": algo1,
                                "Average Velocity": algo2,
                                "Mirror Pattern": algo3,
                                "Date Flow": algo4,
                                "Delta Pattern-A": algo5
                            },
                            threeDigit: {
                                "Direct": algo3D_1,
                                "Reverse": algo3D_2,
                                "Complement": algo3D_3,
                                "Shift +1": algo3D_4,
                                "Shift -1": algo3D_5,
                                "Mirror": algo3D_6,
                                "Key (+2)": algo3D_7,
                                "Flow Pair (Fix)": algo3D_8,
                                "Crossing": algo3D_9,
                                "Repeat Middle": algo3D_10,
                                "Repeat Last": algo3D_11,
                                "Symmetric Drift": algo3D_12,
                                "9-Complement": algo3D_13
                            },
                            guessingBoard: [algo1.slice(-4), algo2.slice(-4), algo3.slice(-4), algo4.slice(-4), algo5.slice(-4)],
                            poolAnalysis: {
                                sum: last3.split('').reduce((a, b) => a + parseInt(b), 0),
                                zone: Math.floor(parseInt(last3) / 200), // 0-4 (0=000-199, 1=200-399, etc)
                                hotStats: getPositionalHotness(drawList),
                                matrix: generateSmartMatrix(last3, drawList)
                            }
                        };
                    };

                    // ... helpers (same as before) ...

                    const historyPrediction = generateFromList(list, istDate);
                    const yesterdayPredictionData = generateFromList(fullList, istDate);

                    const updates = {};
                    
                    if (needsPatch && historyPrediction) {
                        updates.threeDigit = historyPrediction.threeDigit;
                        // Directly verify the patch worked by assigning to local object
                        existing.threeDigit = historyPrediction.threeDigit;
                    }

                    if (!existing.yesterdayPrediction && yesterdayPredictionData) {
                        updates.yesterdayPrediction = {
                            predictedNumbers: yesterdayPredictionData.predictedNumbers,
                            guessingBoard: yesterdayPredictionData.guessingBoard,
                            algorithms: yesterdayPredictionData.algorithms,
                            threeDigit: yesterdayPredictionData.threeDigit,
                            poolAnalysis: yesterdayPredictionData.poolAnalysis
                        };
                        existing.yesterdayPrediction = updates.yesterdayPrediction;
                    }
                    
                    if (!existing.poolAnalysis && historyPrediction) {
                        updates.poolAnalysis = historyPrediction.poolAnalysis;
                        existing.poolAnalysis = historyPrediction.poolAnalysis;
                    }

                    if (Object.keys(updates).length > 0) {
                         // Force update using updateOne to bypass schema checks if any
                         await Prediction.collection.updateOne({ _id: existing._id }, { $set: updates });
                    }
                }
        }
    } catch (e) {
        console.error("Failed to fetch history for trend:", e.message);
    }
    
    // (Fallback removed: If no prediction for today, return null so frontend allows manual generation)


    return NextResponse.json({ exists: !!existing, data: existing, trend });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
