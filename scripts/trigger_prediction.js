require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

// We need to import the actual generation logic. 
// Assuming it's in a lib file or we can hit the API if the server is running.
// If the logic is only inside a route handler (e.g. api/klr/generate-prediction/route.js), 
// we might need to copy it or refactor it to test it via script.

// Let's try to hit the running local server first if it's up.
// But since we are in a script, let's use the route logic if possible.
// Actually, the user mentioned "reset_today_prediction.js". 
// Maybe there is a "generate_prediction.js" script?
// Let's check the directory first.

const fs = require('fs');
const path = require('path');

const scriptsDir = path.join(__dirname);
const files = fs.readdirSync(scriptsDir);

console.log("Scripts available:", files);

// If no generation script exists, we'll write a simple one that calls the API URL 
// (assuming the user has the app running on localhost:3000)

const axios = require('axios'); // We might need to install axios if not present in root, but it is in package.json

async function triggerApi() {
    try {
        console.log("Attempting to trigger generation via API...");
        // Assuming default port 3000 since not specified
        const response = await axios.post('http://localhost:3000/api/klr/generate-prediction');
        console.log("API Response:", response.data);
    } catch (error) {
        console.error("API Call Failed:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
    }
}

triggerApi();
