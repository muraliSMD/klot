const { spawn } = require('child_process');
const path = require('path');

async function runPrediction(modelType) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [
            path.join(process.cwd(), 'python', 'predict.py'),
            modelType
        ]);

        let output = '';
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Error in ${modelType}:`, data.toString());
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(`Python process exited with code ${code}`);
                return;
            }
            try {
                resolve(JSON.parse(output));
            } catch (e) {
                reject(`Failed to parse output: ${output}`);
            }
        });
    });
}

async function compareModels() {
    console.log("--- Starting Model Comparison ---");
    const models = ['rf', 'xgb', 'lstm'];
    
    for (const model of models) {
        process.stdout.write(`Running ${model.toUpperCase()}... `);
        try {
            const result = await runPrediction(model);
            if (result.error) {
                console.log(`Error: ${result.error}`);
            } else {
                console.log(`Predicted: ${result.predicted_number}`);
            }
        } catch (err) {
            console.log(`Failed: ${err}`);
        }
    }
    console.log("--- Comparison Complete ---");
}

compareModels();
