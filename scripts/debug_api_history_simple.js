const axios = require('axios');

async function debug() {
    try {
        console.log("Fetching history...");
        const { data: historyData } = await axios.get(`https://indialotteryapi.com/wp-json/klr/v1/history?limit=1000`);
        const fullList = Array.isArray(historyData) ? historyData : (historyData.items || []);
        console.log(`Total items fetched: ${fullList.length}`);

        const names = fullList.map(item => item.draw_name);
        console.log("Available Draw Names:", names);

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
