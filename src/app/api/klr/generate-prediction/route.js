import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";
import AlgorithmStats from "@/app/lib/models/AlgorithmStats";
import { generateFromList } from "@/app/lib/predictionEngine";
import axios from "axios";
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.KLR_API_BASE_URL || process.env.API || "https://indialotteryapi.com/wp-json/klr/v1";

export async function POST() {
  try {
    await dbConnect();

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const istHours = istDate.getUTCHours();
    const istMinutes = istDate.getUTCMinutes();

    if (istHours < 10 || istHours >= 13) {
      return NextResponse.json({ disabled: true, message: "Predictions can only be generated between 10:00 AM and 1:00 PM IST." }, { status: 403 });
    }

    const today = istDate.toISOString().slice(0, 10);
    const { data: historyData } = await axios.get(`${BASE_URL}/history?limit=1000`);
    const fullList = Array.isArray(historyData) ? historyData : (historyData?.items || []);

    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const lotteryMapping = { 'Sunday': 'SAMRUDHI', 'Monday': 'BHAGYATHARA', 'Tuesday': 'STHREE SAKTHI', 'Wednesday': 'DHANALEKSHMI', 'Thursday': 'KARUNYA PLUS', 'Friday': 'SUVARNA KERALAM', 'Saturday': 'KARUNYA' };
    const targetLottery = lotteryMapping[weekdayNames[istDate.getUTCDay()]];

    const list = fullList.filter(it => it.draw_name && it.draw_name.toUpperCase().startsWith(targetLottery));

    let algoStats = [];
    try { algoStats = await AlgorithmStats.find({}); } catch(e) {}

    // AI Predictions (Ensemble)
    let aiPredictions = {};
    const modelTypes = ['rf', 'xgb', 'lstm'];
    
    let pythonExec = "python3";
    const venvPython = path.resolve("venv/bin/python");
    if (fs.existsSync(venvPython)) {
        pythonExec = venvPython;
    }

    for (const type of modelTypes) {
        try {
            const result = spawnSync(pythonExec, [path.resolve("python/predict.py"), type], { encoding: 'utf-8' });
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

    // Generate prediction: historyPrediction uses same lottery draws (list), yesterdayPredictionData uses overall consecutive draws (validFullList)
    const historyPrediction = generateFromList(list.length >= 3 ? list : fullList, istDate, algoStats, aiPredictions.rf);
    const validFullList = fullList.filter(it => (it.first_ticket && /\d/.test(it.first_ticket)) || (it.result && /\d/.test(it.result)) || (it.mc && Array.isArray(it.mc) && it.mc.length > 0));
    const yesterdayPredictionData = generateFromList(validFullList, istDate, algoStats, aiPredictions.rf);

    if (!historyPrediction) return NextResponse.json({ error: "Insufficient history data" }, { status: 400 });

    const saved = await Prediction.findOneAndUpdate(
        { date: today },
        {
            date: today,
            seedDraw: historyPrediction.seedDraw,
            lastMonthDraw: historyPrediction.lastMonthDraw,
            masterWinner: historyPrediction.masterWinner,
            fullTickets: historyPrediction.fullTickets,
            predictedNumbers: historyPrediction.predictedNumbers,
            topFive: historyPrediction.topFive,
            boxedPermutations: historyPrediction.boxedPermutations,
            guessingBoard: historyPrediction.guessingBoard,
            algorithms: historyPrediction.algorithms,
            threeDigit: historyPrediction.threeDigit,
            lotteryName: targetLottery,
            yesterdayPrediction: yesterdayPredictionData ? {
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
            } : undefined,
            poolAnalysis: historyPrediction.poolAnalysis,
            abcBoard: historyPrediction.abcBoard,
            aiPredictions: aiPredictions
        },
        { upsert: true, new: true }
    );
    
    const savedLean = await Prediction.findOne({ _id: saved._id }).lean();
    return NextResponse.json({ message: "Refined Markov-Ensemble prediction generated", data: savedLean });

  } catch (err) {
    console.error("GENERATE PREDICTION ERROR:", err);
    return NextResponse.json({ error: err.message || "Failed to generate prediction" }, { status: 500 });
  }
}
