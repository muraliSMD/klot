const axios = require('axios');

async function debug() {
    try {
        console.log("Fetching history with per_page=100...");
        // Try per_page instead of limit
        const { data: historyData } = await axios.get(`https://indialotteryapi.com/wp-json/klr/v1/history?per_page=100`);
        const fullList = Array.isArray(historyData) ? historyData : (historyData.items || []);
        console.log(`Total items fetched: ${fullList.length}`);

        const targetLottery = 'SUVARNA KERALAM';
        const list = fullList.filter(it => 
            it.draw_name && 
            it.draw_name.toUpperCase().startsWith(targetLottery)
        );

        console.log(`Filtered for ${targetLottery}: ${list.length} items found.`);
        
    } catch (e) {
        console.error("Error:", e.message);
    }
}

debug();
