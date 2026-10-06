import { NextResponse } from "next/server";
import axios from "axios";
import dbConnect from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";

const BASE_URL = process.env.KLR_API_BASE_URL || process.env.API || "https://indialotteryapi.com/wp-json/klr/v1";
const HISTORY_API_URL = `${BASE_URL}/history?limit=1000`;

function evaluatePredictionAccuracy(pred, rawWinningNumber) {
  if (!rawWinningNumber) {
    return {
      status: "Pending",
      isWin: false,
      accuracyPercent: 0,
      matchSummary: "Pending official draw result verification at 3:30 PM IST",
      abcBreakdown: null
    };
  }

  const winningStr = String(rawWinningNumber).trim();
  const winningNumeric = winningStr.replace(/\D/g, "");

  if (winningNumeric.length < 3) {
    return {
      status: "Pending",
      isWin: false,
      accuracyPercent: 0,
      matchSummary: "Invalid winning ticket data",
      abcBreakdown: null
    };
  }

  const winning3D = winningNumeric.slice(-3);
  const winning2D_AB = winning3D.slice(0, 2);
  const winning2D_BC = winning3D.slice(1, 3);
  const winning2D_AC = winning3D[0] + winning3D[2];
  const winA = winning3D[0];
  const winB = winning3D[1];
  const winC = winning3D[2];

  // Collect all 3D predictions from pred
  const topFive = pred.topFive || [];
  const masterWinner = pred.masterWinner || topFive[0] || "";
  const fullTickets = pred.fullTickets || [];
  const boxedPermutations = pred.boxedPermutations || [];
  const threeDigit = pred.threeDigit || {};
  const abcBoard = pred.abcBoard || {};

  const all3DPredictions = new Set([
    masterWinner,
    ...topFive,
    ...Object.values(threeDigit),
    ...(pred.yesterdayPrediction?.topFive || []),
    ...(Object.values(pred.yesterdayPrediction?.threeDigit || {}))
  ].filter(Boolean));

  const aBoard = [...(abcBoard.aBoard || []), ...(pred.yesterdayPrediction?.abcBoard?.aBoard || [])];
  const bBoard = [...(abcBoard.bBoard || []), ...(pred.yesterdayPrediction?.abcBoard?.bBoard || [])];
  const cBoard = [...(abcBoard.cBoard || []), ...(pred.yesterdayPrediction?.abcBoard?.cBoard || [])];

  const aHit = aBoard.includes(winA);
  const bHit = bBoard.includes(winB);
  const cHit = cBoard.includes(winC) || String(abcBoard.singleDigit) === winC || String(pred.yesterdayPrediction?.abcBoard?.singleDigit) === winC;

  const abcBreakdown = {
    winA,
    winB,
    winC,
    aHit,
    bHit,
    cHit,
    hasSmallPrize: cHit
  };

  // 1. Direct 6D or 3D Hit (100%)
  const isDirect6D = fullTickets.some(t => String(t).replace(/\D/g, "").endsWith(winningNumeric) || String(t).replace(/\D/g, "").slice(-6) === winningNumeric.slice(-6));
  const isDirect3D = Array.from(all3DPredictions).some(p => String(p).slice(-3) === winning3D);

  if (isDirect6D || isDirect3D) {
    const hitLabel = isDirect6D ? "Direct 6-Digit Winning Ticket Hit" : `Direct 3-Digit Hit on '${winning3D}' (A:${winA}, B:${winB}, C:${winC})`;
    return {
      status: "Win",
      isWin: true,
      accuracyPercent: 100,
      matchSummary: `100% GRAND WIN 🎉: ${hitLabel}`,
      abcBreakdown
    };
  }

  // 2. Boxed 3D Hit (85%)
  const sortedWinning3D = winning3D.split('').sort().join('');
  const isBoxedHit = boxedPermutations.some(b => String(b) === winning3D) || 
                     Array.from(all3DPredictions).some(p => String(p).split('').sort().join('') === sortedWinning3D);

  if (isBoxedHit) {
    return {
      status: "Boxed Win",
      isWin: true,
      accuracyPercent: 85,
      matchSummary: `85% BOXED WIN 📦: Matched permutations of 3D '${winning3D}' (A:${winA}, B:${winB}, C:${winC})`,
      abcBreakdown
    };
  }

  // 3. 2-Digit Pair Hit (65%)
  const abPairs = [...(abcBoard.abPairs || []), ...(pred.yesterdayPrediction?.abcBoard?.abPairs || [])];
  const bcPairs = [...(abcBoard.bcPairs || []), ...(pred.yesterdayPrediction?.abcBoard?.bcPairs || [])];
  const acPairs = [...(abcBoard.acPairs || []), ...(pred.yesterdayPrediction?.abcBoard?.acPairs || [])];

  const abHit = abPairs.includes(winning2D_AB);
  const bcHit = bcPairs.includes(winning2D_BC);
  const acHit = acPairs.includes(winning2D_AC);

  if (abHit || bcHit || acHit) {
    const hitTypes = [];
    if (abHit) hitTypes.push(`AB Pair '${winning2D_AB}'`);
    if (bcHit) hitTypes.push(`BC Pair '${winning2D_BC}'`);
    if (acHit) hitTypes.push(`AC Pair '${winning2D_AC}'`);

    const cPrizeNote = cHit ? " + C-Board Small Prize Winner! 🏆" : "";

    return {
      status: "Pair Hit",
      isWin: false,
      accuracyPercent: cHit ? 70 : 65,
      matchSummary: `${cHit ? 70 : 65}% PAIR HIT 🎯: Matched 2D ${hitTypes.join(", ")}${cPrizeNote}`,
      abcBreakdown
    };
  }

  // 4. Positional / Single Digit & C-Board Small Prize Hit (55% or 45%)
  if (aHit || bHit || cHit) {
    const hits = [];
    if (cHit) hits.push(`C-Board Last Digit '${winC}' 🏆`);
    if (bHit) hits.push(`B-Pos '${winB}'`);
    if (aHit) hits.push(`A-Pos '${winA}'`);

    return {
      status: cHit ? "C-Board Prize" : "Digit Hit",
      isWin: false,
      accuracyPercent: cHit ? 55 : 45,
      matchSummary: cHit 
        ? `55% C-BOARD WIN 🏆: Matched last digit C='${winC}' (Small Prize Winner!)`
        : `45% POSITIONAL HIT 🔢: Matched ${hits.join(", ")}`,
      abcBreakdown
    };
  }

  // 5. Close Miss (30%)
  let isClose = false;
  for (const p of all3DPredictions) {
    const pStr = String(p).slice(-3);
    if (pStr.length === 3) {
      let diffCount = 0;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(parseInt(pStr[i]) - parseInt(winning3D[i])) <= 1) {
          diffCount++;
        }
      }
      if (diffCount >= 2) {
        isClose = true;
        break;
      }
    }
  }

  if (isClose) {
    return {
      status: "Close Miss",
      isWin: false,
      accuracyPercent: 30,
      matchSummary: `30% CLOSE MISS ⚡: Predictions were 1 digit off target winning 3D '${winning3D}' (A:${winA}, B:${winB}, C:${winC})`,
      abcBreakdown
    };
  }

  return {
    status: "Loss",
    isWin: false,
    accuracyPercent: 10,
    matchSummary: `10% MISS ❌: Draw winner was '${winning3D}' (A:${winA}, B:${winB}, C:${winC})`,
    abcBreakdown
  };
}

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
    }

    // 3. Merge Data
    const historyMap = historyItems.reduce((acc, item) => {
        const dateKey = item.draw_date || item.date; 
        if(dateKey) acc[dateKey] = item;
        return acc;
    }, {});

    const performanceData = predictions.map(pred => {
        const historyMatch = historyMap[pred.date];
        const winningNumber = historyMatch ? (historyMatch.first_ticket || historyMatch.firstprize) : null;
        
        const evalResult = evaluatePredictionAccuracy(pred, winningNumber);

        return {
            _id: pred._id,
            date: pred.date,
            lotteryName: historyMatch?.draw_name || pred.lotteryName || "Unknown",
            winningNumber: winningNumber || "Waiting...",
            status: evalResult.status,
            isWin: evalResult.isWin,
            accuracyPercent: evalResult.accuracyPercent,
            matchSummary: evalResult.matchSummary,
            abcBreakdown: evalResult.abcBreakdown,

            // Full Prediction Payload from Predict API
            masterWinner: pred.masterWinner || pred.topFive?.[0] || "",
            fullTickets: pred.fullTickets || [],
            topFive: pred.topFive || [],
            boxedPermutations: pred.boxedPermutations || [],
            predictedNumbers: pred.predictedNumbers || [],
            guessingBoard: pred.guessingBoard || [],
            algorithms: pred.algorithms || {},
            threeDigit: pred.threeDigit || {},
            abcBoard: pred.abcBoard || {},
            poolAnalysis: pred.poolAnalysis || {},
            yesterdayPrediction: pred.yesterdayPrediction || null,
            aiPredictions: pred.aiPredictions || {}
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
