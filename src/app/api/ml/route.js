import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import dbConnect from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";

import fs from "fs";

// Helper to run python scripts
async function runPythonScript(scriptPath, args = []) {
    return new Promise((resolve, reject) => {
        let pythonExec = "python";
        const venvPython = path.resolve("venv/bin/python");
        const python3Exec = "python3";

        if (fs.existsSync(venvPython)) {
            pythonExec = venvPython;
        } else {
            pythonExec = python3Exec;
        }

        const process = spawn(pythonExec, [path.resolve(scriptPath), ...args]);
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

const ALLOWED_MODELS = ["rf", "xgb", "lstm"];
const ALLOWED_GET_ACTIONS = ["predict", "backtest"];

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");
        const model = searchParams.get("model") || "rf";

        if (!ALLOWED_GET_ACTIONS.includes(action)) {
            return NextResponse.json({ error: "Invalid or unsupported action" }, { status: 400 });
        }

        if (!ALLOWED_MODELS.includes(model)) {
            return NextResponse.json({ error: "Invalid model specification" }, { status: 400 });
        }

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
        console.error("ML GET Route Error:", error);
        return NextResponse.json({ error: "ML operation encountered an error" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { action, model } = body;

        if (action === "train") {
            const TRAINING_SCRIPTS = {
                rf: "python/train_model.py",
                xgb: "python/train_xgboost.py",
                lstm: "python/train_lstm.py",
                fetch: "python/fetch_data.py"
            };

            const script = TRAINING_SCRIPTS[model];
            if (!script) {
                return NextResponse.json({ error: "Invalid or unauthorized model type" }, { status: 400 });
            }

            const result = await runPythonScript(script);
            return NextResponse.json({ success: true, result });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("ML POST Route Error:", error);
        return NextResponse.json({ error: "ML training encountered an error" }, { status: 500 });
    }
}
