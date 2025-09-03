const fetch = require("node-fetch");

const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

// Fetch ALL updates from Telegram (without offset tracking)
async function getAllUpdates() {
  try {
    let allUpdates = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const url = `${BASE_URL}/getUpdates?offset=${offset}&limit=100`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.ok && data.result.length > 0) {
        allUpdates = allUpdates.concat(data.result);
        offset = data.result[data.result.length - 1].update_id + 1;
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        hasMore = false;
      }
    }
    
    return { ok: true, result: allUpdates };
  } catch (err) {
    console.error("Error fetching updates:", err);
    return { ok: false, result: [] };
  }
}

// Get file path for a fileId
async function getFilePath(fileId) {
  try {
    const url = `${BASE_URL}/getFile?file_id=${fileId}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.ok) {
      return data.result.file_path;
    }
    return null;
  } catch (err) {
    console.error("Error getting file path:", err);
    return null;
  }
}

module.exports = {
  getAllUpdates, // Changed from getUpdates
  getFilePath,
};
