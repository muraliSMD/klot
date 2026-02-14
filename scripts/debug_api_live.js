const axios = require('axios');

async function checkHistory() {
    try {
        console.log("Fetching history...");
        const { data: historyData } = await axios.get(`https://indialotteryapi.com/wp-json/klr/v1/history?limit=10`);
        const list = Array.isArray(historyData) ? historyData : (historyData.items || []);
        
        console.log(`Fetched ${list.length} items.`);
        
        // Log top 3 items full structure
        list.slice(0, 3).forEach((item, i) => {
            console.log(`[${i}] Full Item:`, JSON.stringify(item));
        });

        // Check for today (Simulated for 2026-02-14 if needed, but using system time)
        // Note: The environment might be different, but let's see what the latest dates are.
    } catch (error) {
        console.error("Error fetching:", error.message);
    }
}

checkHistory();
