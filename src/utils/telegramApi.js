const fetch = require("node-fetch");

const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

let lastUpdateId = 0; // track where we left off

// Fetch updates from Telegram
async function getUpdates(limit = 20) {
  try {
    const url = `${BASE_URL}/getUpdates?offset=${lastUpdateId + 1}&limit=${limit}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.ok && data.result.length > 0) {
      // update offset so old updates are skipped next time
      lastUpdateId = data.result[data.result.length - 1].update_id;
    }

    return data;
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
  getUpdates,
  getFilePath,
};
