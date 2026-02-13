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
    const istMinutes = istDate.getUTCMinutes();

    // Predictions only allowed between 11:00 AM and 2:30 PM IST (using correct minute logic)
    if (istHours < 11 || istHours > 14 || (istHours === 14 && istMinutes > 30)) {
      return NextResponse.json({ 
        disabled: true, 
        message: "Predictions can only be generated between 11:00 AM and 2:30 PM IST." 
      }, { status: 403 });
    }

    const today = istDate.toISOString().slice(0, 10);
    // Force regeneration even if exists (to apply new algorithms)
    // if (existing) {
    //   return NextResponse.json({ message: "Prediction for today already exists", data: existing });
    // }

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

    console.log(`[Generate] Target Lottery: ${targetLottery}`);
    if (!list.length) {
       console.error(`[Generate] No history found for ${targetLottery}`);
       return NextResponse.json({ error: "No historical data for today's lottery found" }, { status: 404 });
    }
    console.log(`[Generate] Found ${list.length} history items.`);

    // Helper to generate predictions from a list of draws
    const generateFromList = (drawList, dateObj) => {
        // Relaxed requirement: Allow 1 item, default trend will be used
        if (!drawList || drawList.length < 1) return null;

        const latestDraw = drawList[0]; 
        const previousDraw = drawList[1];

        console.log(`[Generate] Latest Draw: ${latestDraw?.draw_name}, FirstTicket: '${latestDraw?.first_ticket}', MC: ${JSON.stringify(latestDraw?.mc)}`);

        // Robust extractor for winning number (supports first_ticket, result, or mc array)
        // Check for content that actually contains digits
        const getWinningNumber = (draw) => {
            if (!draw) return null;
            if (draw.first_ticket && draw.first_ticket.trim().length > 0 && /\d/.test(draw.first_ticket)) return draw.first_ticket;
            if (draw.result && draw.result.trim().length > 0 && /\d/.test(draw.result)) return draw.result;
            if (draw.mc && Array.isArray(draw.mc) && draw.mc.length > 0) return draw.mc[0];
            return null;
        };

        const winningNumber = getWinningNumber(latestDraw);
        console.log(`[Generate] Extracted Winning Number: ${winningNumber}`);

        if (!winningNumber) {
            console.error("[Generate] Failed to extract winning number from latest draw.");
            return null;
        }
        const numericPart = winningNumber.replace(/\D/g, ''); 
        let trend = numericPart.split('').map(() => 1);

        const prevWinning = getWinningNumber(previousDraw);
        if (previousDraw && prevWinning) {
            const prevNumeric = prevWinning.replace(/\D/g, '');
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

        // 5. Algo: Delta Pattern-A
        const deltaPattern = [3, 0, 4, 9, 4, 6];
        const algo5 = applyShift(numericPart, deltaPattern);

        // 6. Algo: Smart Delta (Dynamic based on day)
        const dayIndex = dateObj.getUTCDay();
        const smartDelta = [dayIndex, (dayIndex + 2) % 10, (dayIndex + 5) % 10, dayIndex, (dayIndex + 3) % 10, (dayIndex + 7) % 10];
        const algo6 = applyShift(numericPart, smartDelta);

        // 7. Algo: Neighbor Reach (Climber)
        const algo7 = applyShift(numericPart, [1, 1, 1, 1, 1, 1]);

        // --- Split-Logic Architecture (New 6-Digit Algos) ---
        const first3 = numericPart.slice(0, 3);
        const last3 = numericPart.slice(-3); // Define last3 for analysis

        // Algo 8: Split-Merge Trend (Independent trends for First-3 and Last-3)
        // This allows the "Series" (First 3) to move differently than the "Number" (Last 3)
        const trendFirst3 = trend.slice(0, 3);
        const trendLast3 = trend.slice(-3);
        const predFirst3 = applyShift(first3, trendFirst3);
        const predLast3 = applyShift(last3, trendLast3);
        const algo8 = predFirst3 + predLast3;

        // Algo 9: Composite Merge (Hot Series + Smart Last 3)
        // Uses the "Hot" digit for 100k position to anchor a new series
        // And combines it with the "Direct" last 3 calculation
        const hotFirstDigit = list.length > 0 ? getPositionalHotness(list)[0][0] : first3[0]; // Hot 100k digit
        const seriesAnchor = hotFirstDigit + first3.slice(1); // Keep rest of series static relative to hot anchor
        const algo9 = seriesAnchor + last3;

        // 3-Digit Logic Implementation
        const digitArray = last3.split('').map(Number);
        
        const algo3D_1 = last3; // Direct
        const algo3D_2 = last3.split('').reverse().join(''); // Reverse
        const algo3D_3 = digitArray.map(d => 9 - d).join(''); // Complement (9-x)
        const algo3D_4 = digitArray.map(d => (d + 1) % 10).join(''); // Shift +1
        const algo3D_5 = digitArray.map(d => (d - 1 + 10) % 10).join(''); // Shift -1
        const algo3D_6 = digitArray.map(d => (d + 5) % 10).join(''); // Mirror (d+5)
        const algo3D_7 = digitArray.map(d => (d + 2) % 10).join(''); // Key (d+2)
        
        // New 3-Digit Algos (Requested Focus)
        // 3D-8: Flow Pair (Hot First + Same Last Pair) - Fixes 012 vs 712 type errors
        const algo3D_8 = (list.length > 0 ? getPositionalHotness(list)[0][0] : ((digitArray[0]+5)%10)) + last3.slice(1);
        
        // 3D-9: Crossing (Last -> First)
        const algo3D_9 = last3.slice(-1) + last3.slice(0, 2); 

        // New Algos for "Vertical Repeat" (Fixing 510 miss type where middle '1' repeated)
        // 3D-10: Repeat Middle (Trend First, Repeat Middle, Trend Last)
        // We need the Trend for 1st and 3rd digit.
        // digitArray is [d1, d2, d3]. trendLast3 is [t1, t2, t3].
        const d1_trend = (digitArray[0] + trendLast3[0]) % 10;
        const d2_repeat = digitArray[1]; // Keep middle same
        const d3_trend = (digitArray[2] + trendLast3[2]) % 10;
        const algo3D_10 = `${d1_trend}${d2_repeat}${d3_trend}`;

        // 3D-11: Repeat Last (Trend First, Trend Middle, Repeat Last)
        const d1_trend_last = (digitArray[0] + trendLast3[0]) % 10;
        const d2_trend_last = (digitArray[1] + trendLast3[1]) % 10;
        const d3_repeat = digitArray[2]; // Keep last same
        const algo3D_11 = `${d1_trend_last}${d2_trend_last}${d3_repeat}`;

        // 3D-12: Symmetric Drift (Targeting 712 -> 510 pattern: -2, 0, -2)
        // Shifts outer digits by -2 (or +8), keeps middle digit same
        const algo3D_12 = digitArray.map((d, i) => {
            if (i === 1) return d; // Middle stays
            return (d - 2 + 10) % 10; // Outer drift -2
        }).join('');

        // 3D-13: 9-Complement (Mathematical Inverse)
        // Flips the number field (High -> Low, Low -> High)
        const algo3D_13 = digitArray.map(d => 9 - d).join('');

        return {
            predictedNumbers: [algo1, algo2, algo3, algo4, algo5, algo6, algo7, algo8, algo9],
            algorithms: {
                "Linear Trend": algo1,
                "Average Velocity": algo2,
                "Mirror Pattern": algo3,
                "Date Flow": algo4,
                "Delta Pattern-A": algo5,
                "Smart Delta": algo6,
                "Neighbor Reach": algo7,
                "Split-Merge Trend": algo8,
                "Composite (Hot Series)": algo9
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
            guessingBoard: [algo1.slice(-4), algo2.slice(-4), algo3.slice(-4), algo4.slice(-4), algo5.slice(-4), algo6.slice(-4), algo7.slice(-4), algo8.slice(-4), algo9.slice(-4)],
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

    const saved = await Prediction.findOneAndUpdate(
        { date: today },
        {
            date: today,
            predictedNumbers: historyPrediction.predictedNumbers,
            guessingBoard: historyPrediction.guessingBoard,
            algorithms: historyPrediction.algorithms,
            threeDigit: historyPrediction.threeDigit, // Pass the 3-digit data
            lotteryName: targetLottery,
            yesterdayPrediction: yesterdayPredictionData ? {
                predictedNumbers: yesterdayPredictionData.predictedNumbers,
                guessingBoard: yesterdayPredictionData.guessingBoard,
                algorithms: yesterdayPredictionData.algorithms,
                threeDigit: yesterdayPredictionData.threeDigit, // Ensure this is also passed if needed
                poolAnalysis: yesterdayPredictionData.poolAnalysis
            } : undefined,
            poolAnalysis: historyPrediction.poolAnalysis
        },
        { upsert: true, new: true }
    );
    
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
