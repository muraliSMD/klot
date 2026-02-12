const fs = require('fs');
const axios = require('axios');

async function analyze() {
  const BASE_URL = "https://indialotteryapi.com/wp-json/klr/v1";
  let output = "Fetching History...\n";

  try {
    const { data: historyData } = await axios.get(`${BASE_URL}/history?limit=10`);
    const list = Array.isArray(historyData) ? historyData : (historyData.items || []);

    output += "\n--- Recent Results ---\n";
    list.forEach((item, i) => {
      const num = item.first_ticket || "N/A";
      const three = num.replace(/\D/g, '').slice(-3);
      output += `${i}. ${item.draw_name} (${item.draw_date}): ${num} -> [${three}]\n`;
    });
    
    fs.writeFileSync('analysis_output.txt', output);
    console.log("Written to analysis_output.txt");

  } catch (e) {
    console.error(e.message);
  }
}

analyze();
