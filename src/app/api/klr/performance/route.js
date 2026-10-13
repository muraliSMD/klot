import { NextResponse } from "next/server";
import axios from "axios";
import dbConnect from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";
import { syncAndGetHistory } from "@/app/lib/historyService";

function normalizeDateKey(rawDate) {
  if (!rawDate) return "";
  const s = String(rawDate).trim();
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }
  return s.slice(0, 10);
}

function extractBoardDigits(boardArr) {
  if (!Array.isArray(boardArr)) return [];
  return boardArr.map(d => String(d).trim()).filter(Boolean);
}

function extract3DPredictions(pred) {
  const set = new Set();

  if (pred.masterWinner) set.add(String(pred.masterWinner).slice(-3));

  if (Array.isArray(pred.topFive)) {
    pred.topFive.forEach(v => v && set.add(String(v).slice(-3)));
  }

  if (Array.isArray(pred.predictedNumbers)) {
    pred.predictedNumbers.forEach(v => v && set.add(String(v).slice(-3)));
  }

  if (Array.isArray(pred.guessingBoard)) {
    pred.guessingBoard.forEach(v => v && set.add(String(v).slice(-3)));
  }

  if (pred.threeDigit) {
    const entries = pred.threeDigit instanceof Map ? Object.fromEntries(pred.threeDigit) : pred.threeDigit;
    Object.values(entries).forEach(v => v && set.add(String(v).slice(-3)));
  }

  if (pred.yesterdayPrediction) {
    const y = pred.yesterdayPrediction;
    if (y.masterWinner) set.add(String(y.masterWinner).slice(-3));
    if (Array.isArray(y.topFive)) y.topFive.forEach(v => v && set.add(String(v).slice(-3)));
    if (y.threeDigit) {
      const yEntries = y.threeDigit instanceof Map ? Object.fromEntries(y.threeDigit) : y.threeDigit;
      Object.values(yEntries).forEach(v => v && set.add(String(v).slice(-3)));
    }
  }

  return Array.from(set).filter(v => v.length === 3 && /^\d{3}$/.test(v));
}

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

  const abcBoard = pred.abcBoard || {};
  const aBoard = extractBoardDigits([...(abcBoard.aBoard || []), ...(pred.yesterdayPrediction?.abcBoard?.aBoard || [])]);
  const bBoard = extractBoardDigits([...(abcBoard.bBoard || []), ...(pred.yesterdayPrediction?.abcBoard?.bBoard || [])]);
  const cBoard = extractBoardDigits([...(abcBoard.cBoard || []), ...(pred.yesterdayPrediction?.abcBoard?.cBoard || [])]);

  const singleTarget = String(pred.singleTargetNumber || abcBoard.singleDigit || abcBoard.singleTargetNumber || "").trim();
  
  const aHit = aBoard.includes(winA);
  const bHit = bBoard.includes(winB);
  const cHit = cBoard.includes(winC) || singleTarget === winC;

  const abcBreakdown = {
    winA,
    winB,
    winC,
    aHit,
    bHit,
    cHit,
    matchedPositions: [aHit && "A", bHit && "B", cHit && "C"].filter(Boolean),
    hasSmallPrize: cHit
  };

  const all3DPreds = extract3DPredictions(pred);
  const fullTickets = Array.isArray(pred.fullTickets) ? pred.fullTickets : [];

  // 1. Direct 6D or 3D Hit (100%)
  const isDirect6D = fullTickets.some(t => {
    const num = String(t).replace(/\D/g, "");
    return num.endsWith(winningNumeric) || (winningNumeric.length >= 6 && num.slice(-6) === winningNumeric.slice(-6));
  });
  const isDirect3D = all3DPreds.includes(winning3D);

  if (isDirect6D || isDirect3D) {
    const hitLabel = isDirect6D ? "Direct 6-Digit Ticket Hit" : `Direct 3-Digit Hit on '${winning3D}' (A:${winA}, B:${winB}, C:${winC})`;
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
  const boxedList = Array.isArray(pred.boxedPermutations) ? pred.boxedPermutations.map(b => String(b)) : [];
  const isBoxedHit = boxedList.includes(winning3D) || all3DPreds.some(p => p.split('').sort().join('') === sortedWinning3D);

  if (isBoxedHit) {
    return {
      status: "Boxed Win",
      isWin: true,
      accuracyPercent: 85,
      matchSummary: `85% BOXED WIN 📦: Permutation match for 3D '${winning3D}' (A:${winA}, B:${winB}, C:${winC})`,
      abcBreakdown
    };
  }

  // 3. Triple Positional Matrix Hit (80%)
  if (aHit && bHit && cHit) {
    return {
      status: "Matrix Win",
      isWin: true,
      accuracyPercent: 80,
      matchSummary: `80% POSITIONAL MATRIX WIN 🎯: Matched A='${winA}', B='${winB}', C='${winC}' across all boards!`,
      abcBreakdown
    };
  }

  // 4. 2-Digit Pair Hit (65% - 75%)
  const abPairs = [...(abcBoard.abPairs || []), ...(pred.yesterdayPrediction?.abcBoard?.abPairs || [])].map(String);
  const bcPairs = [...(abcBoard.bcPairs || []), ...(pred.yesterdayPrediction?.abcBoard?.bcPairs || []), ...(abcBoard.topBcPairs || [])].map(String);
  const acPairs = [...(abcBoard.acPairs || []), ...(pred.yesterdayPrediction?.abcBoard?.acPairs || [])].map(String);

  const abHit = abPairs.includes(winning2D_AB);
  const bcHit = bcPairs.includes(winning2D_BC);
  const acHit = acPairs.includes(winning2D_AC);

  if (abHit || bcHit || acHit) {
    const hitPairs = [];
    if (abHit) hitPairs.push(`AB Pair '${winning2D_AB}'`);
    if (bcHit) hitPairs.push(`BC Pair '${winning2D_BC}'`);
    if (acHit) hitPairs.push(`AC Pair '${winning2D_AC}'`);

    const thirdDigitHit = (abHit && cHit) || (bcHit && aHit) || (acHit && bHit);
    const accPct = thirdDigitHit ? 75 : 65;
    const cNote = thirdDigitHit ? " + 3rd Digit Hit! 🏆" : "";

    return {
      status: "Pair Hit",
      isWin: false,
      accuracyPercent: accPct,
      matchSummary: `${accPct}% PAIR HIT 🎯: Matched ${hitPairs.join(", ")}${cNote}`,
      abcBreakdown
    };
  }

  // 5. Double or Single Positional Board Hit (45% - 70%)
  const positionalHits = [];
  if (aHit) positionalHits.push(`A-Pos '${winA}'`);
  if (bHit) positionalHits.push(`B-Pos '${winB}'`);
  if (cHit) positionalHits.push(`C-Board '${winC}' 🏆`);

  if (positionalHits.length >= 2) {
    return {
      status: "Positional Win",
      isWin: false,
      accuracyPercent: 70,
      matchSummary: `70% DOUBLE POSITIONAL HIT 🔢: Matched ${positionalHits.join(" & ")}`,
      abcBreakdown
    };
  }

  if (positionalHits.length === 1) {
    const accPct = cHit ? 55 : 45;
    return {
      status: cHit ? "C-Board Prize" : "Digit Hit",
      isWin: false,
      accuracyPercent: accPct,
      matchSummary: `${accPct}% POSITIONAL HIT 🔢: Matched ${positionalHits.join(", ")}`,
      abcBreakdown
    };
  }

  // 6. Close Miss (30%)
  let isClose = false;
  for (const p of all3DPreds) {
    let diffCount = 0;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(parseInt(p[i], 10) - parseInt(winning3D[i], 10)) <= 1) {
        diffCount++;
      }
    }
    if (diffCount >= 2) {
      isClose = true;
      break;
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

    // 2. Fetch official history with automatic MongoDB DB fallback
    const historyItems = await syncAndGetHistory(1000);

    // 3. Build normalized history map for robust date matching
    const historyMap = {};
    historyItems.forEach(item => {
        const d1 = normalizeDateKey(item.draw_date);
        const d2 = normalizeDateKey(item.date);
        if (d1) historyMap[d1] = item;
        if (d2) historyMap[d2] = item;
        if (item.draw_date) historyMap[String(item.draw_date).trim()] = item;
        if (item.date) historyMap[String(item.date).trim()] = item;
    });

    const performanceData = predictions.map(pred => {
        const normDate = normalizeDateKey(pred.date);
        const historyMatch = historyMap[normDate] || historyMap[pred.date];
        const winningNumber = historyMatch ? (historyMatch.first_ticket || historyMatch.firstprize) : null;
        
        const evalResult = evaluatePredictionAccuracy(pred, winningNumber);

        // Single Target Number Analysis
        const singleTargetNumber = String(pred.singleTargetNumber || pred.abcBoard?.singleDigit || pred.abcBoard?.singleTargetNumber || "").trim();
        
        let singleTargetAnalysis = {
            targetNumber: singleTargetNumber || "N/A",
            isHit: false,
            matchedPositions: [],
            statusText: singleTargetNumber ? "Pending Draw" : "Not Set"
        };

        if (winningNumber && singleTargetNumber) {
            const winningStr = String(winningNumber).trim();
            const winningNumeric = winningStr.replace(/\D/g, "");
            if (winningNumeric.length >= 3) {
                const winning3D = winningNumeric.slice(-3);
                const winA = winning3D[0];
                const winB = winning3D[1];
                const winC = winning3D[2];

                const hits = [];
                if (winA === singleTargetNumber) hits.push("A");
                if (winB === singleTargetNumber) hits.push("B");
                if (winC === singleTargetNumber) hits.push("C");

                if (hits.length > 0) {
                    singleTargetAnalysis.isHit = true;
                    singleTargetAnalysis.matchedPositions = hits;
                    singleTargetAnalysis.statusText = `HIT in ${hits.join(", ")}-Board (Position ${hits.map(h => h === "A" ? "1" : h === "B" ? "2" : "3").join(", ")})`;
                } else {
                    singleTargetAnalysis.isHit = false;
                    singleTargetAnalysis.statusText = `MISS in Last 3D (${winning3D})`;
                }
            }
        }

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
            singleTargetNumber: singleTargetNumber,
            singleTargetAnalysis: singleTargetAnalysis,

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
