import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";
import AlgorithmStats from "@/app/lib/models/AlgorithmStats";
import axios from "axios";
import { spawnSync } from "child_process";
import path from "path";

const BASE_URL = "https://indialotteryapi.com/wp-json/klr/v1";

// --- Helper Functions (Moved outside POST for better scoping) ---

// 1. Analyze Positional Frequency (0=100s, 1=10s, 2=1s)
const getPositionalHotness = (drawList) => {
    const counts = [{0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0}, {0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0}, {0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0}];
    
    const limit = Math.min(drawList.length, 50);
    for(let i=0; i<limit; i++) {
        const d = drawList[i];
        if(d) {
            const ticket = d.first_ticket || d.result || (d.mc && d.mc[0]);
            if(ticket) {
                const num = ticket.toString().replace(/\D/g, '').slice(-3);
                if(num.length === 3) {
                    counts[0][num[0]]++; // 100s
                    counts[1][num[1]]++; // 10s
                    counts[2][num[2]]++; // 1s
                }
            }
        }
    }
    
    return counts.map(posCounts => {
         return Object.entries(posCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 2)
            .map(([digit]) => digit);
    });
};

// 2. Smart Matrix Generator v2
const generateSmartMatrix = (seed3, historyList = []) => {
    const seed = parseInt(seed3);
    const candidates = new Set();
    
    [-3, -2, -1, 0, 1, 2, 3].forEach(d => candidates.add((seed + d + 1000) % 1000));
    const mirror = seed3.split('').map(d => (parseInt(d) + 5) % 10).join('');
    candidates.add(parseInt(mirror));
    candidates.add((seed + 111) % 1000);
    candidates.add((seed + 889) % 1000);
    
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
    
    if (historyList.length > 0) {
        const hotDigits = getPositionalHotness(historyList);
        hotDigits[0].forEach(d1 => {
            hotDigits[1].forEach(d2 => {
                hotDigits[2].forEach(d3 => {
                    candidates.add(parseInt(`${d1}${d2}${d3}`));
                });
            });
        });
    }
    
    return Array.from(candidates).map(n => n.toString().padStart(3, '0')).slice(0, 20);
};

// 3. Main Generation Logic
const generateFromList = (drawList, dateObj, algorithmStats = [], aiPrediction = null) => {
    if (!drawList || drawList.length < 1) return null;

    const latestDraw = drawList[0]; 
    const previousDraw = drawList[1];

    const getWinningNumber = (draw) => {
        if (!draw) return null;
        if (draw.first_ticket && draw.first_ticket.trim().length > 0 && /\d/.test(draw.first_ticket)) return draw.first_ticket;
        if (draw.result && draw.result.trim().length > 0 && /\d/.test(draw.result)) return draw.result;
        if (draw.mc && Array.isArray(draw.mc) && draw.mc.length > 0) return draw.mc[0];
        return null;
    };

    const winningNumber = getWinningNumber(latestDraw);
    if (!winningNumber) return null;
    
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

    const algo1 = applyShift(numericPart, trend);
    let velocityTrend = [...trend];
    if (drawList[2]) {
        const d2 = getWinningNumber(drawList[1])?.replace(/\D/g, '');
        const d3 = getWinningNumber(drawList[2])?.replace(/\D/g, '');
        if (d2 && d3 && d2.length === d3.length) {
            const trend2 = d2.split('').map((d, i) => (parseInt(d) - parseInt(d3[i]) + 10) % 10);
            velocityTrend = trend.map((t, i) => Math.round((t + trend2[i]) / 2));
        }
    }
    const algo2 = applyShift(numericPart, velocityTrend);
    const algo3 = algo1.split('').map(d => (parseInt(d) + 5) % 10).join('');
    const dayOfMonth = dateObj.getUTCDate();
    const algo4 = algo1.split('').map(d => (parseInt(d) + dayOfMonth) % 10).join('');
    const algo5 = applyShift(numericPart, [3, 0, 4, 9, 4, 6]);
    const dayIndex = dateObj.getUTCDay();
    const algo6 = applyShift(numericPart, [dayIndex, (dayIndex + 2) % 10, (dayIndex + 5) % 10, dayIndex, (dayIndex + 3) % 10, (dayIndex + 7) % 10]);
    const algo7 = applyShift(numericPart, [1, 1, 1, 1, 1, 1]);

    const first3 = numericPart.slice(0, 3);
    const last3 = numericPart.slice(-3);
    const trendFirst3 = trend.slice(0, 3);
    const trendLast3 = trend.slice(-3);
    const algo8 = applyShift(first3, trendFirst3) + applyShift(last3, trendLast3);
    const hotFirstDigit = drawList.length > 0 ? getPositionalHotness(drawList)[0][0] : first3[0];
    const algo9 = (hotFirstDigit + first3.slice(1)) + last3;

    const digitArray = last3.split('').map(Number);
    const algo3D_1 = last3;
    const algo3D_2 = last3.split('').reverse().join('');
    const algo3D_3 = digitArray.map(d => 9 - d).join('');
    const algo3D_4 = digitArray.map(d => (d + 1) % 10).join('');
    const algo3D_5 = digitArray.map(d => (d - 1 + 10) % 10).join('');
    const algo3D_6 = digitArray.map(d => (d + 5) % 10).join('');
    const algo3D_7 = digitArray.map(d => (d + 2) % 10).join('');
    const algo3D_8 = (drawList.length > 0 ? getPositionalHotness(drawList)[0][0] : ((digitArray[0]+5)%10)) + last3.slice(1);
    const algo3D_9 = last3.slice(-1) + last3.slice(0, 2); 
    const algo3D_10 = `${(digitArray[0] + trendLast3[0]) % 10}${digitArray[1]}${(digitArray[2] + trendLast3[2]) % 10}`;
    const algo3D_11 = `${(digitArray[0] + trendLast3[0]) % 10}${(digitArray[1] + trendLast3[1]) % 10}${digitArray[2]}`;
    const algo3D_12 = digitArray.map((d, i) => (i === 1 ? d : (d - 2 + 10) % 10)).join('');
    const algo3D_13 = digitArray.map(d => 9 - d).join('');
    const algo3D_14 = digitArray.map((d, i) => (i === 1 ? d : (d + 5) % 10)).join('');
    const algo3D_15 = digitArray.map((d, i) => (i === 1 ? (d + 5) % 10 : d)).join('');
    const algo3D_16 = digitArray.map(d => (d + 1) % 10).join('');
    
    // Position Median
    const getPositionalMedian = (dl) => {
        const dgs = [[], [], []];
        const lim = Math.min(dl.length, 10);
        for(let i=0; i<lim; i++) {
            const n = getWinningNumber(dl[i])?.replace(/\D/g, '').slice(-3);
            if(n?.length === 3) {
                dgs[0].push(parseInt(n[0])); dgs[1].push(parseInt(n[1])); dgs[2].push(parseInt(n[2]));
            }
        }
        return dgs.map(pos => pos.length === 0 ? 5 : pos.sort((a,b)=>a-b)[Math.floor(pos.length/2)]);
    };
    const algo3D_17 = getPositionalMedian(drawList).join('');

    const allCandidates = [
        algo1.slice(-3), algo2.slice(-3), algo3.slice(-3), algo4.slice(-3), algo5.slice(-3), algo6.slice(-3), algo7.slice(-3), algo8.slice(-3), algo9.slice(-3),
        algo3D_1, algo3D_2, algo3D_3, algo3D_4, algo3D_5, algo3D_6, algo3D_7, algo3D_8, algo3D_9, algo3D_10, algo3D_11, algo3D_12, algo3D_13, algo3D_14, algo3D_15, algo3D_16, algo3D_17
    ];

    const freqMap = {};
    allCandidates.forEach(num => { freqMap[num] = (freqMap[num] || 0) + 1; });

    // Boosts
    [algo9.slice(-3), algo3D_10, algo3D_8].forEach(num => { if(freqMap[num]) freqMap[num] += 2.0; });
    const aiNum = aiPrediction?.predictedNumber?.slice(-3);
    if (aiNum && freqMap[aiNum]) { freqMap[aiNum] += 5.0; }

    const candidateMap = {
        [algo9.slice(-3)]: "Composite (Hot Series)", [algo3D_8]: "Flow Pair (Fix)", [algo3D_10]: "Repeat Middle", [algo3D_12]: "Symmetric Drift", [algo3D_9]: "Crossing"
    };

    if (algorithmStats && Array.isArray(algorithmStats)) {
        algorithmStats.forEach(stat => {
            if (stat.hits > 0) {
                if (stat.algoKey === "Flow Pair (Fix)" && freqMap[algo3D_8]) freqMap[algo3D_8] += (stat.hits * 0.5);
                if (stat.algoKey === "Repeat Middle" && freqMap[algo3D_10]) freqMap[algo3D_10] += (stat.hits * 0.5);
            }
        });
    }

    const sortedConsensus = Object.entries(freqMap).sort(([, a], [, b]) => b - a).map(([num]) => num);
    const topThree = sortedConsensus.slice(0, 3); // Strictly 3

    return {
        predictedNumbers: [algo1, algo2, algo3, algo4, algo5, algo6, algo7, algo8, algo9],
        topFive: topThree,
        algorithms: {
            "Linear Trend": algo1, "Average Velocity": algo2, "Mirror Pattern": algo3, "Date Flow": algo4, "Delta Pattern-A": algo5, "Smart Delta": algo6, "Neighbor Reach": algo7, "Split-Merge Trend": algo8, "Composite (Hot Series)": algo9
        },
        threeDigit: {
            "Direct": algo3D_1, "Reverse": algo3D_2, "Complement": algo3D_3, "Shift +1": algo3D_4, "Shift -1": algo3D_5, "Mirror": algo3D_6, "Key (+2)": algo3D_7, "Flow Pair (Fix)": algo3D_8, "Crossing": algo3D_9, "Repeat Middle": algo3D_10, "Repeat Last": algo3D_11, "Symmetric Drift": algo3D_12, "9-Complement": algo3D_13, "Mirror Outer": algo3D_14, "Mirror Inner": algo3D_15, "Sequence Flow": algo3D_16, "Position Median": algo3D_17
        },
        guessingBoard: [algo1.slice(-4), algo2.slice(-4), algo3.slice(-4), algo4.slice(-4), algo5.slice(-4), algo6.slice(-4), algo7.slice(-4), algo8.slice(-4), algo9.slice(-4)],
        poolAnalysis: {
            sum: last3.split('').reduce((a, b) => a + parseInt(b), 0),
            zone: Math.floor(parseInt(last3) / 200),
            hotStats: getPositionalHotness(drawList),
            matrix: generateSmartMatrix(last3, drawList)
        }
    };
};

export async function POST() {
  try {
    await dbConnect();

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const istHours = istDate.getUTCHours();
    const istMinutes = istDate.getUTCMinutes();

    if (istHours < 11 || istHours > 14 || (istHours === 14 && istMinutes > 30)) {
      return NextResponse.json({ disabled: true, message: "Predictions can only be generated between 11:00 AM and 2:30 PM IST." }, { status: 403 });
    }

    const today = istDate.toISOString().slice(0, 10);
    const { data: historyData } = await axios.get(`${BASE_URL}/history?limit=1000`);
    const fullList = Array.isArray(historyData) ? historyData : (historyData.items || []);

    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const lotteryMapping = { 'Sunday': 'SAMRUDHI', 'Monday': 'BHAGYATHARA', 'Tuesday': 'STHREE SAKTHI', 'Wednesday': 'DHANALEKSHMI', 'Thursday': 'KARUNYA PLUS', 'Friday': 'SUVARNA KERALAM', 'Saturday': 'KARUNYA' };
    const targetLottery = lotteryMapping[weekdayNames[istDate.getUTCDay()]];

    const list = fullList.filter(it => it.draw_name && it.draw_name.toUpperCase().startsWith(targetLottery));

    let algoStats = [];
    try { algoStats = await AlgorithmStats.find({}); } catch(e) {}

    // AI Predictions (Ensemble)
    let aiPredictions = {};
    const modelTypes = ['rf', 'xgb', 'lstm'];
    
    for (const type of modelTypes) {
        try {
            const result = spawnSync("python", [path.resolve("python/predict.py"), type], { encoding: 'utf-8' });
            if (result.stdout) {
                const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.predicted_number) {
                        aiPredictions[type] = { 
                            predictedNumber: parsed.predicted_number, 
                            targetDate: parsed.target_date, 
                            confidence: type === 'rf' ? 0.85 : type === 'xgb' ? 0.88 : 0.82, 
                            features: parsed.features 
                        };
                    }
                }
            }
        } catch (e) {
            console.error(`AI Prediction error for ${type}:`, e);
        }
    }

    const historyPrediction = generateFromList(list, istDate, algoStats, aiPredictions.rf);
    const validFullList = fullList.filter(it => (it.first_ticket && /\d/.test(it.first_ticket)) || (it.result && /\d/.test(it.result)) || (it.mc && Array.isArray(it.mc) && it.mc.length > 0));
    const yesterdayPredictionData = generateFromList(validFullList, istDate, algoStats, aiPredictions.rf);

    if (!historyPrediction) return NextResponse.json({ error: "Insufficient history data" }, { status: 400 });

    const saved = await Prediction.findOneAndUpdate(
        { date: today },
        {
            date: today,
            predictedNumbers: historyPrediction.predictedNumbers,
            topFive: historyPrediction.topFive,
            guessingBoard: historyPrediction.guessingBoard,
            algorithms: historyPrediction.algorithms,
            threeDigit: historyPrediction.threeDigit,
            lotteryName: targetLottery,
            yesterdayPrediction: yesterdayPredictionData ? {
                predictedNumbers: yesterdayPredictionData.predictedNumbers,
                topFive: yesterdayPredictionData.topFive,
                guessingBoard: yesterdayPredictionData.guessingBoard,
                algorithms: yesterdayPredictionData.algorithms,
                threeDigit: yesterdayPredictionData.threeDigit,
                poolAnalysis: yesterdayPredictionData.poolAnalysis
            } : undefined,
            poolAnalysis: historyPrediction.poolAnalysis,
            aiPredictions: aiPredictions
        },
        { upsert: true, new: true }
    );
    
    const savedLean = await Prediction.findOne({ _id: saved._id }).lean();
    return NextResponse.json({ message: "Refined prediction generated", data: savedLean });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
