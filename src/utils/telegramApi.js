const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;

class TelegramAPI {
  constructor() {
    this.baseURL = 'https://api.telegram.org/bot' + BOT_TOKEN;
  }
  
  async getUpdates(limit = 20) {
    try {
      const response = await axios.get(`${this.baseURL}/getUpdates?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error getting updates:', error.message);
      throw error;
    }
  }
  
  async getFilePath(fileId) {
    try {
      const response = await axios.get(`${this.baseURL}/getFile?file_id=${fileId}`);
      
      if (response.data.ok) {
        return response.data.result.file_path;
      }
      return null;
    } catch (error) {
      console.error('Error getting file path:', error.message);
      return null;
    }
  }
}

module.exports = new TelegramAPI();