import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";
import axios from "axios";

const BASE_URL = "https://indialotteryapi.com/wp-json/klr/v1";

export async function POST() {
  try {
    await dbConnect();

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const istHours = istDate.getUTCHours();

    // Predictions only allowed between 11:00 AM and 1:00 PM IST
    if (istHours >= 13 || istHours < 11) {
      return NextResponse.json({ 
        disabled: true, 
        message: "Predictions can only be generated between 11:00 AM and 1:00 PM IST." 
      }, { status: 403 });
    }

    const today = istDate.toISOString().slice(0, 10);
    let existing = await Prediction.findOne({ date: today });
    if (existing) {
      return NextResponse.json({ message: "Prediction for today already exists", data: existing });
    }

    // Fetch History to find today's specific lottery
    const { data: historyData } = await axios.get(`${BASE_URL}/history?limit=1000`);
    const fullList = Array.isArray(historyData) ? historyData : (historyData.items || []);

    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const istDay = istDate.getUTCDay();
    const dayOfWeek = weekdayNames[istDay];

    const lotteryMapping = {
        'Sunday': 'SAMRUDHI',
        'Monday': 'BHAGYATHARA',
        'Tuesday': 'STHREE SAKTHI',
        'Wednesday': 'DHANALEKSHMI',
        'Thursday': 'KARUNYA PLUS',
        'Friday': 'SUVARNA KERALAM',
        'Saturday': 'KARUNYA'
    };

    const targetLottery = lotteryMapping[dayOfWeek];

    // Filter list for the specific lottery series
    const list = fullList.filter(it => 
        it.draw_name && 
        it.draw_name.toUpperCase().startsWith(targetLottery)
    );

    if (!list.length) {
       return NextResponse.json({ error: "No historical data for today's lottery found" }, { status: 404 });
    }

    // Helper to generate predictions from a list of draws
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

        // Algos
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

        // 5. Algo: Delta Pattern-A (Based on specific user request for 227873 -> 521719)
        // Pattern: +3, +0, -6(+4), -1(+9), -6(+4), +6
        const deltaPattern = [3, 0, 4, 9, 4, 6];
        const algo5 = applyShift(numericPart, deltaPattern);

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
                "Shift -1": algo3D_5
            },
            guessingBoard: [algo1.slice(-4), algo2.slice(-4), algo3.slice(-4), algo4.slice(-4), algo5.slice(-4)],
            poolAnalysis: {
                sum: last3.split('').reduce((a, b) => a + parseInt(b), 0),
                zone: Math.floor(parseInt(last3) / 200), // 0-4 (0=000-199, 1=200-399, etc)
                hotStats: getPositionalHotness(list), // [ [100s], [10s], [1s] ]
                matrix: generateSmartMatrix(last3, list) // Upgrade: Pass list for frequency analysis
            }
        };
    };
    
    // Helper: Analyze Positional Frequency (0=100s, 1=10s, 2=1s)
    const getPositionalHotness = (drawList) => {
        const counts = [{0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0}, {0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0}, {0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0}];
        
        // Analyze last 50 draws or max available
        const limit = Math.min(drawList.length, 50);
        for(let i=0; i<limit; i++) {
            if(drawList[i] && drawList[i].first_ticket) {
                const num = drawList[i].first_ticket.replace(/\D/g, '').slice(-3);
                if(num.length === 3) {
                    counts[0][num[0]]++; // 100s
                    counts[1][num[1]]++; // 10s
                    counts[2][num[2]]++; // 1s
                }
            }
        }
        
        // Return top 2 digits for each position
        return counts.map(posCounts => {
             return Object.entries(posCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 2)
                .map(([digit]) => digit);
        });
    };

    // Helper: Smart Matrix Generator v2 (Enhanced)
    const generateSmartMatrix = (seed3, historyList = []) => {
        const seed = parseInt(seed3);
        const candidates = new Set();
        
        // 1. Neighbors (+/- 1, 2, 3)
        [-3, -2, -1, 0, 1, 2, 3].forEach(d => candidates.add((seed + d + 1000) % 1000));
        
        // 2. Mirror (Add 5 to each digit)
        const mirror = seed3.split('').map(d => (parseInt(d) + 5) % 10).join('');
        candidates.add(parseInt(mirror));
        
        // 3. Pattern Shifts (e.g., +111, -111)
        candidates.add((seed + 111) % 1000);
        candidates.add((seed + 889) % 1000); // -111 equiv
        
        // 4. Sum Cousins (Same Sum)
        const targetSum = seed3.split('').reduce((a, b) => a + parseInt(b), 0);
        let found = 0;
        for (let i = 0; i < 1000; i++) {
            if (found >= 3) break;
            const s = i.toString().padStart(3, '0');
            const sum = s.split('').reduce((a, b) => a + parseInt(b), 0);
            if (sum === targetSum && i !== seed) {
                candidates.add(i);
                found++;
            }
        }
        
        // 5. [NEW] Hot Structure Injection
        if (historyList.length > 0) {
            const hotDigits = getPositionalHotness(historyList); // [[d1, d2], [d1, d2], [d1, d2]]
            // Generate combos from hot digits
            hotDigits[0].forEach(d1 => {
                hotDigits[1].forEach(d2 => {
                    hotDigits[2].forEach(d3 => {
                        candidates.add(parseInt(`${d1}${d2}${d3}`));
                    });
                });
            });
        }
        
        return Array.from(candidates).map(n => n.toString().padStart(3, '0')).slice(0, 20); // Increased limit
    };

    // 1. History Based (Same Name)
    const historyPrediction = generateFromList(list, istDate);

    // 2. Yesterday Based (Global Last Draw)
    // fullList[0] is the latest draw (Yesterday's). 
    const yesterdayPredictionData = generateFromList(fullList, istDate);

    if (!historyPrediction) {
         return NextResponse.json({ error: "Insufficient history data" }, { status: 400 });
    }

    const saved = await Prediction.create({
        date: today,
        predictedNumbers: historyPrediction.predictedNumbers,
        guessingBoard: historyPrediction.guessingBoard,
        algorithms: historyPrediction.algorithms,
        lotteryName: targetLottery,
        yesterdayPrediction: yesterdayPredictionData ? {
            predictedNumbers: yesterdayPredictionData.predictedNumbers,
            guessingBoard: yesterdayPredictionData.guessingBoard,
            algorithms: yesterdayPredictionData.algorithms
        } : undefined
    });
    
    // Re-fetch as lean to ensure the response includes all fields (avoiding schema stripping in dev)
    const savedLean = await Prediction.findOne({ _id: saved._id }).lean();

    return NextResponse.json({ 
        message: "Refined prediction generated", 
        data: savedLean 
    });

  } catch (err) {
    console.error("Prediction Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
