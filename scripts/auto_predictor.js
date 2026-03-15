const axios = require('axios');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const LOG_FILE = path.resolve(__dirname, '../logs/automation.log');
const API_URL = `http://localhost:${process.env.PORT || 3000}/api/klr/generate-prediction`;

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(LOG_FILE))) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function log(message) {
    const timestamp = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    fs.appendFileSync(LOG_FILE, logMessage);
}

async function triggerPrediction() {
    log("Manual check: Triggering daily prediction...");
    try {
        const response = await axios.post(API_URL);
        log(`SUCCESS: Prediction generated. Response: ${JSON.stringify(response.data.message)}`);
    } catch (error) {
        if (error.response && error.response.status === 403) {
            log(`INFO: API returned 403 (Forbidden). Likely outside allowed time window: ${error.response.data.message}`);
        } else {
            log(`ERROR: Failed to trigger prediction: ${error.message}`);
        }
    }
}

function startScheduler() {
    log("Scheduler started. Monitoring time for 12:00 PM IST...");
    
    // Check every 60 seconds
    setInterval(() => {
        const nowIST = moment().tz('Asia/Kolkata');
        const hours = nowIST.hours();
        const minutes = nowIST.minutes();

        // Target: 12:00 PM IST
        if (hours === 12 && minutes === 0) {
            log("Current time is 12:00 PM IST. Triggering automation...");
            triggerPrediction();
        }
        
        // Optional: Heartbeat every hour
        if (minutes === 0 && hours !== 12) {
            log(`Heartbeat: Scheduler is running. Current IST: ${nowIST.format('HH:mm')}`);
        }

    }, 60000); 
}

// Global error handler for the background process
process.on('uncaughtException', (err) => {
    log(`FATAL ERROR: ${err.message}`);
    process.exit(1);
});

startScheduler();
