import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/db";
import { fetchWithCache } from "@/app/lib/apiCache";
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
    
    const BASE_URL = process.env.KLR_API_BASE_URL || process.env.API || "https://indialotteryapi.com/wp-json/klr/v1";
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
        const historyData = await fetchWithCache(`${BASE_URL}/history?limit=300`, 5 * 60 * 1000);
        const fullList = Array.isArray(historyData) ? historyData : (historyData?.items || []);

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
                               !existing?.threeDigit["Symmetric Drift"];

            if (existing && (needsPatch || !existing.yesterdayPrediction)) {
                const historyPrediction = generateFromList(list, istDate);
                const yesterdayPredictionData = generateFromList(fullList, istDate);

                const updates = {};
                
                if (needsPatch && historyPrediction) {
                    updates.threeDigit = historyPrediction.threeDigit;
                    existing.threeDigit = historyPrediction.threeDigit;
                }

                if (!existing.yesterdayPrediction && yesterdayPredictionData) {
                    updates.yesterdayPrediction = {
                        seedDraw: yesterdayPredictionData.seedDraw,
                        masterWinner: yesterdayPredictionData.masterWinner,
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
