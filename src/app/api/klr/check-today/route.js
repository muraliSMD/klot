import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/db";
import { syncAndGetHistory } from "@/app/lib/historyService";
import Prediction from "@/app/lib/models/Prediction";
import { generateFromList } from "@/app/lib/predictionEngine";

export async function GET() {
  try {
    await dbConnect();
    
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const istHours = istDate.getUTCHours();
    const istMinutes = istDate.getUTCMinutes();

    const today = istDate.toISOString().slice(0, 10);
    let existing = await Prediction.findOne({ date: today }).lean();
    
    let trend = [];
    
    if (!existing) {
        if (istHours < 10 || istHours >= 13) {
          return NextResponse.json({ 
            disabled: true, 
            message: "Predictions are only available between 10:00 AM and 1:00 PM IST." 
          });
        }
    }
    
    let targetLottery = "";
    let dayOfWeek = "";
    
    try {
        const fullList = await syncAndGetHistory(300);

        const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const istDay = istDate.getUTCDay();
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

        const list = fullList.filter(it => 
            it.draw_name && 
            it.draw_name.toUpperCase().startsWith(targetLottery)
        );

        const latestDraw = list[0]; 
        const previousDraw = list[1];

        if (latestDraw && latestDraw.first_ticket) {
            const winningNumber = String(latestDraw.first_ticket); 
            const numericPart = winningNumber.replace(/\D/g, ''); 
            
            trend = numericPart.split('').map(() => 1);

            if (previousDraw && previousDraw.first_ticket) {
                const prevNumeric = String(previousDraw.first_ticket).replace(/\D/g, '');
                if (prevNumeric.length === numericPart.length) {
                    trend = numericPart.split('').map((d, i) => {
                        const currDigit = parseInt(d, 10);
                        const prevDigit = parseInt(prevNumeric[i], 10);
                        return (currDigit - prevDigit + 10) % 10;
                    });
                }
            }

            const needsPatch = !existing?.threeDigit || 
                               !existing?.threeDigit["Repeat Middle"] || 
                               !existing?.threeDigit["A-Anchor BC-Mirror"];

            if (existing && !existing.result && (needsPatch || !existing.yesterdayPrediction || !existing.singleTargetNumber)) {
                const historyPrediction = generateFromList(list, istDate);
                const yesterdayPredictionData = generateFromList(fullList, istDate);

                const updates = {};
                
                if (historyPrediction && (!existing.singleTargetNumber || !existing.singleTargetPatternInfo)) {
                    const st = historyPrediction.singleTargetNumber || historyPrediction.abcBoard?.singleDigit || "5";
                    updates.singleTargetNumber = st;
                    updates.singleTargetBoard = historyPrediction.singleTargetBoard || "C";
                    updates.singleTargetConfidence = historyPrediction.singleTargetConfidence || 92.5;
                    updates.singleTargetPatternInfo = historyPrediction.singleTargetPatternInfo;
                    existing.singleTargetNumber = st;
                    existing.singleTargetBoard = updates.singleTargetBoard;
                    existing.singleTargetConfidence = updates.singleTargetConfidence;
                    existing.singleTargetPatternInfo = updates.singleTargetPatternInfo;
                }

                if (historyPrediction) {
                    if (!existing.structuredPatternMatrix) {
                        updates.structuredPatternMatrix = historyPrediction.structuredPatternMatrix;
                        existing.structuredPatternMatrix = historyPrediction.structuredPatternMatrix;
                    }
                    if (!existing.aiDiscoveredPattern) {
                        updates.aiDiscoveredPattern = historyPrediction.aiDiscoveredPattern;
                        existing.aiDiscoveredPattern = historyPrediction.aiDiscoveredPattern;
                    }
                    if (!existing.preVerification) {
                        updates.preVerification = historyPrediction.preVerification;
                        existing.preVerification = historyPrediction.preVerification;
                    }

                    // Safely merge threeDigit without ever overwriting existing keys like Direct!
                    if (!existing.threeDigit) {
                        updates.threeDigit = historyPrediction.threeDigit;
                        existing.threeDigit = historyPrediction.threeDigit;
                    } else if (historyPrediction.threeDigit) {
                        const existingThree = existing.threeDigit instanceof Map ? Object.fromEntries(existing.threeDigit) : (existing.threeDigit || {});
                        const mergedThree = { ...historyPrediction.threeDigit, ...existingThree };
                        // Direct must be preserved strictly as originally generated
                        if (existingThree["Direct"]) {
                            mergedThree["Direct"] = existingThree["Direct"];
                        }
                        updates.threeDigit = mergedThree;
                        existing.threeDigit = mergedThree;
                    }
                }

                if (!existing.yesterdayPrediction && yesterdayPredictionData) {
                    updates.yesterdayPrediction = {
                        seedDraw: yesterdayPredictionData.seedDraw,
                        masterWinner: yesterdayPredictionData.masterWinner,
                        singleTargetNumber: yesterdayPredictionData.singleTargetNumber || yesterdayPredictionData.abcBoard?.singleDigit || "5",
                        singleTargetBoard: yesterdayPredictionData.singleTargetBoard || "C",
                        singleTargetConfidence: yesterdayPredictionData.singleTargetConfidence || 92.5,
                        singleTargetPatternInfo: yesterdayPredictionData.singleTargetPatternInfo,
                        fullTickets: yesterdayPredictionData.fullTickets,
                        predictedNumbers: yesterdayPredictionData.predictedNumbers,
                        topFive: yesterdayPredictionData.topFive,
                        boxedPermutations: yesterdayPredictionData.boxedPermutations,
                        guessingBoard: yesterdayPredictionData.guessingBoard,
                        algorithms: yesterdayPredictionData.algorithms,
                        threeDigit: yesterdayPredictionData.threeDigit,
                        poolAnalysis: yesterdayPredictionData.poolAnalysis,
                        abcBoard: yesterdayPredictionData.abcBoard
                    };
                    existing.yesterdayPrediction = updates.yesterdayPrediction;
                }
                
                if (!existing.poolAnalysis && historyPrediction) {
                    updates.poolAnalysis = historyPrediction.poolAnalysis;
                    existing.poolAnalysis = historyPrediction.poolAnalysis;
                }

                if (Object.keys(updates).length > 0) {
                    await Prediction.collection.updateOne({ _id: existing._id }, { $set: updates });
                }
            }
        }
    } catch (e) {
        console.error("Failed to fetch history for trend:", e.message);
    }

    return NextResponse.json({ exists: !!existing, data: existing, trend });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
