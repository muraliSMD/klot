import { NextResponse } from "next/server";
import axios from "axios";
import connectDB from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";
import AlgorithmStats from "@/app/lib/models/AlgorithmStats";
import moment from "moment-timezone";

// Force dynamic behavior
export const dynamic = 'force-dynamic';

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

        // 2. Fetch Live Result from External API
        const { data: historyData } = await axios.get(`https://indialotteryapi.com/wp-json/klr/v1/history?limit=5`);
        const todayDraw = Array.isArray(historyData) ? historyData.find(d => (d.draw_date === today || d.date === today)) : historyData.items?.find(d => (d.draw_date === today || d.date === today));

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
            for (const [key, val] of Object.entries(prediction.threeDigit)) {
                if (val === winner) {
                    winningAlgos.push(key); // e.g., "Direct", "Flow Pair (Fix)"
                    isDirectHit = true;
                }
            }
        }

        // Check 6-Digit Algorithms (suffix)
        if (prediction.algorithms) {
            for (const [key, val] of prediction.algorithms.entries()) {
                if (val.endsWith(winner)) {
                    winningAlgos.push(key);
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
        if (prediction.poolAnalysis && prediction.poolAnalysis.matrix && prediction.poolAnalysis.matrix.includes(winner)) {
            winningAlgos.push("Smart Matrix");
            isDirectHit = true;
        }
        
        // Box Hit Logic (if not direct)
        if (!isDirectHit) {
            const winnerPerm = winner.split('').sort().join('');
            // Check top 5 for box
            if (prediction.topFive) {
                 prediction.topFive.forEach(num => {
                     if (num.split('').sort().join('') === winnerPerm) isBoxHit = true;
                 });
            }
        }

        // 4. Learning: Update Algorithm Stats
        for (const algo of winningAlgos) {
            // Mapping friendly names to keys if needed, or just use friendly names
            await AlgorithmStats.findOneAndUpdate(
                { algoKey: algo },
                { 
                    $inc: { hits: 1 },
                    $set: { lastHitDate: new Date() }
                },
                { upsert: true }
            );
        }
        
        // Always increment totalRuns for tracked algos (Consensus, Matrix, etc)
        const TRACKED_KEYS = ["Consensus Top 5", "Smart Matrix", "Direct", "Reverse", "Flow Pair (Fix)", "Repeat Middle", "Symmetric Drift"];
        await AlgorithmStats.updateMany(
            { algoKey: { $in: TRACKED_KEYS } },
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
            winningAlgos 
        });

    } catch (error) {
        console.error("Verification Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
