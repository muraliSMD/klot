const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function checkRaw() {
    const client = new MongoClient(process.env.MONGO_URI);
    try {
        await client.connect();
        const db = client.db();
        const collection = db.collection('predictions'); // Check actual collection name
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + istOffset);
        const today = istDate.toISOString().slice(0, 10);
        
        const doc = await collection.findOne({ date: today });
        console.log("RAW DOC:", JSON.stringify(doc, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
checkRaw();
