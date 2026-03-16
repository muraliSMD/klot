import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import dbConnect from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";

// Helper to run python scripts
async function runPythonScript(scriptPath, args = []) {
    return new Promise((resolve, reject) => {
        const process = spawn("python", [path.resolve(scriptPath), ...args]);
        let stdout = "";
        let stderr = "";

        process.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        process.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        process.on("close", (code) => {
            if (code !== 0) {
                reject(stderr || `Process exited with code ${code}`);
                return;
            }
            try {
                // Try to find JSON in the output
                const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    resolve(JSON.parse(jsonMatch[0]));
                } else {
                    resolve({ message: stdout.trim() });
                }
            } catch (e) {
                resolve({ message: stdout.trim() });
            }
        });
    });
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");
        const model = searchParams.get("model") || "rf";

        if (action === "predict") {
            const result = await runPythonScript("python/predict.py", [model]);
            return NextResponse.json(result);
        }

        if (action === "backtest") {
            const result = await runPythonScript("python/backtest.py", [model]);
            return NextResponse.json(result);
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { action, model } = body;

        if (action === "train") {
            let script = "";
            if (model === "rf") script = "python/train_model.py";
            else if (model === "xgb") script = "python/train_xgboost.py";
            else if (model === "lstm") script = "python/train_lstm.py";
            else if (model === "fetch") script = "python/fetch_data.py";
            else return NextResponse.json({ error: "Invalid model" }, { status: 400 });

            // Run training in background (don't await for too long if it takes time)
            // But for now, we'll await to give feedback to UI
            const result = await runPythonScript(script);
            return NextResponse.json({ success: true, result });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
