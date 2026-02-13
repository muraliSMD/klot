const axios = require('axios');

async function debug() {
    try {
        console.log("Fetching history...");
        const { data: historyData } = await axios.get(`https://indialotteryapi.com/wp-json/klr/v1/history?limit=1000`);
        const fullList = Array.isArray(historyData) ? historyData : (historyData.items || []);
        
        const targetLottery = 'SUVARNA KERALAM';
        const list = fullList.filter(it => 
            it.draw_name && 
            it.draw_name.toUpperCase().startsWith(targetLottery)
        );

        console.log(`Found ${list.length} items for ${targetLottery}`);

        if (list.length > 0) {
            console.log("First Item First Ticket:", list[0].first_ticket);
            console.log("First Item Full:", JSON.stringify(list[0], null, 2));
        } else {
            console.log("List is empty.");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

debug();
