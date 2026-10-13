import { NextResponse } from "next/server";
import axios from "axios";
import connectDB from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";
import AlgorithmStats from "@/app/lib/models/AlgorithmStats";
import moment from "moment-timezone";
import { syncAndGetHistory } from "@/app/lib/historyService";

// Force dynamic behavior
export const dynamic = 'force-dynamic';

function normalizeDateStr(dStr) {
  if (!dStr) return "";
  const s = String(dStr).trim();
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  return s.slice(0, 10);
}

export async function POST(req) {
    try {
        await connectDB();
        const today = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");

        // 1. Fetch Today's Prediction from DB
        const prediction = await Prediction.findOne({ date: today });
        if (!prediction) {
            return NextResponse.json({ error: "No prediction found for today" }, { status: 404 });
        }

        if (prediction.result) {
            return NextResponse.json({ message: "Already verified", result: prediction.result, outcome: prediction.outcome });
        }

        // 2. Fetch Live Result from External API with MongoDB Fallback
        const historyData = await syncAndGetHistory(15);
        const todayDraw = historyData.find(d => {
            const d1 = normalizeDateStr(d.draw_date);
            const d2 = normalizeDateStr(d.date);
            return d1 === today || d2 === today || d.draw_date === today || d.date === today;
        });

        if (!todayDraw) {
            return NextResponse.json({ error: "Live result not yet available" }, { status: 400 });
        }

        // Extract winning number (Priority: first_ticket > result > mc[0])
        let winner = null;
        if (todayDraw.first_ticket && /\d/.test(todayDraw.first_ticket)) winner = todayDraw.first_ticket.slice(-3);
        else if (todayDraw.result && /\d/.test(todayDraw.result)) winner = todayDraw.result.slice(-3);
        else if (todayDraw.mc && todayDraw.mc.length > 0) winner = todayDraw.mc[0].slice(-3);

        if (!winner || winner.length !== 3) {
            return NextResponse.json({ error: "Invalid winning number format" }, { status: 400 });
        }

        // 3. Verification Logic
        const winningAlgos = [];
        let isDirectHit = false;
        let isBoxHit = false; // Permutation match

        // Check 3-Digit Algorithms
        if (prediction.threeDigit) {
            const threeObj = prediction.threeDigit instanceof Map 
                ? Object.fromEntries(prediction.threeDigit) 
                : prediction.threeDigit;
            for (const [key, val] of Object.entries(threeObj)) {
                if (String(val).slice(-3) === winner) {
                    winningAlgos.push(key);
                    isDirectHit = true;
                }
            }
        }

        // Check Yesterday's 3-Digit Algorithms
        if (prediction.yesterdayPrediction?.threeDigit) {
            const yThreeObj = prediction.yesterdayPrediction.threeDigit instanceof Map 
                ? Object.fromEntries(prediction.yesterdayPrediction.threeDigit) 
                : prediction.yesterdayPrediction.threeDigit;
            for (const [key, val] of Object.entries(yThreeObj)) {
                if (String(val).slice(-3) === winner) {
                    const tag = `Yesterday's ${key}`;
                    if (!winningAlgos.includes(tag)) winningAlgos.push(tag);
                    isDirectHit = true;
                }
            }
        }

        // Check Master Winner
        if (prediction.masterWinner && String(prediction.masterWinner).slice(-3) === winner) {
            if (!winningAlgos.includes("Master Pick")) winningAlgos.push("Master Pick");
            isDirectHit = true;
        }

        // Check 6-Digit Algorithms (suffix)
        if (prediction.algorithms) {
            const algos = prediction.algorithms instanceof Map 
                ? Object.fromEntries(prediction.algorithms) 
                : (prediction.algorithms || {});
            for (const [key, val] of Object.entries(algos)) {
                if (String(val).endsWith(winner)) {
                    if (!winningAlgos.includes(key)) winningAlgos.push(key);
                    isDirectHit = true;
                }
            }
        }

        // Check Consensus / Top 5
        if (prediction.topFive && prediction.topFive.includes(winner)) {
            winningAlgos.push("Consensus Top 5");
            isDirectHit = true;
        }

        // Check Smart Matrix
        if (prediction.poolAnalysis?.matrix && prediction.poolAnalysis.matrix.includes(winner)) {
            winningAlgos.push("Smart Matrix");
            isDirectHit = true;
        }
        
        // Check Full Tickets
        if (Array.isArray(prediction.fullTickets)) {
            prediction.fullTickets.forEach(t => {
                const num = String(t).replace(/\D/g, "");
                if (num.endsWith(winner)) {
                    if (!winningAlgos.includes("Full 6D Ticket")) winningAlgos.push("Full 6D Ticket");
                    isDirectHit = true;
                }
            });
        }

        // Box Hit Logic
        const winnerPerm = winner.split('').sort().join('');
        const allBoxCandidates = [
            ...(prediction.topFive || []),
            ...(prediction.boxedPermutations || []),
            ...(prediction.yesterdayPrediction?.topFive || []),
            ...(prediction.yesterdayPrediction?.boxedPermutations || []),
            ...(prediction.threeDigit ? Object.values(prediction.threeDigit instanceof Map ? Object.fromEntries(prediction.threeDigit) : prediction.threeDigit) : [])
        ];

        for (const num of allBoxCandidates) {
            if (num && String(num).length === 3 && String(num).split('').sort().join('') === winnerPerm) {
                isBoxHit = true;
                if (!isDirectHit && !winningAlgos.includes("Box Permutation")) {
                    winningAlgos.push("Box Permutation");
                }
                break;
            }
        }

        // 4. Learning: Update Algorithm Stats
        for (const algo of winningAlgos) {
            await AlgorithmStats.findOneAndUpdate(
                { algoKey: algo },
                { 
                    $inc: { hits: 1 },
                    $set: { lastHitDate: new Date() }
                },
                { upsert: true }
            );
        }
        
        // Increment totalRuns for all tracked algorithms
        const allTrackedKeys = new Set([
            "Consensus Top 5", "Smart Matrix", "Master Pick",
            ...Object.keys(prediction.threeDigit instanceof Map ? Object.fromEntries(prediction.threeDigit) : (prediction.threeDigit || {}))
        ]);
        if (prediction.yesterdayPrediction?.threeDigit) {
            const yKeys = Object.keys(prediction.yesterdayPrediction.threeDigit instanceof Map ? Object.fromEntries(prediction.yesterdayPrediction.threeDigit) : prediction.yesterdayPrediction.threeDigit);
            yKeys.forEach(k => allTrackedKeys.add(`Yesterday's ${k}`));
        }

        await AlgorithmStats.updateMany(
            { algoKey: { $in: Array.from(allTrackedKeys) } },
            { $inc: { totalRuns: 1 } }
        );

        // 5. Save Result to Prediction
        prediction.result = winner;
        prediction.outcome = {
            isDirectHit,
            isBoxHit,
            winningAlgos,
            matchedNumber: winner
        };
        await prediction.save();

        return NextResponse.json({ 
            message: "Verification Complete", 
            winner, 
            isDirectHit, 
            isBoxHit,
            winningAlgos 
        });

    } catch (error) {
        console.error("Verification Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
