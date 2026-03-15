const axios = require('axios');

async function debug() {
    try {
        console.log("Fetching history...");
        const { data: historyData } = await axios.get(`https://indialotteryapi.com/wp-json/klr/v1/history?limit=1000`);
        const fullList = Array.isArray(historyData) ? historyData : (historyData.items || []);
        console.log(`Total items fetched: ${fullList.length}`);

        // Today is Friday -> SUVARNA KERALAM
        const targetLottery = 'SUVARNA KERALAM';
        const list = fullList.filter(it => 
            it.draw_name && 
            it.draw_name.toUpperCase().startsWith(targetLottery)
        );

        console.log(`Filtered for ${targetLottery}: ${list.length} items found.`);

        if (list.length > 0) {
            console.log("First item:", JSON.stringify(list[0], null, 2));
            console.log("Second item:", JSON.stringify(list[1], null, 2));
        } else {
            console.log("No items found for Suvarna Keralam. Previous Items:");
            // Check previous 5 items to see what lottery names ARE there
            fullList.slice(0, 5).forEach(item => {
                console.log(`- ${item.draw_name} (${item.date})`);
            });
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

debug();
