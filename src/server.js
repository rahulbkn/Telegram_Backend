const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Your Telegram bot token from environment variable
const BOT_TOKEN = process.env.BOT_TOKEN;
const API_KEY = process.env.API_KEY;

// Simple authentication middleware
const authenticate = (req, res, next) => {
  const clientApiKey = req.headers['x-api-key'];
  
  if (!clientApiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  if (clientApiKey !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', server: 'Render', timestamp: new Date().toISOString() });
});

// Endpoint to get files - PROTECTED with API key
app.get('/api/files', authenticate, async (req, res) => {
  try {
    console.log('Fetching files from Telegram...');
    
    if (!BOT_TOKEN) {
      return res.status(500).json({ error: 'Bot token not configured' });
    }
    
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=10`
    );
    
    const files = [];
    
    if (response.data.ok) {
      const updates = response.data.result;
      
      for (const update of updates) {
        if (update.message) {
          const message = update.message;
          
          // Process documents
          if (message.document) {
            const fileId = message.document.file_id;
            const filePath = await getFilePath(fileId);
            
            if (filePath) {
              files.push({
                fileId: fileId,
                fileName: message.document.file_name || 'Document',
                filePath: filePath,
                directLink: `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`,
                type: 'document'
              });
            }
          }
          
          // Process photos (largest size)
          if (message.photo && message.photo.length > 0) {
            const largestPhoto = message.photo[message.photo.length - 1];
            const fileId = largestPhoto.file_id;
            const filePath = await getFilePath(fileId);
            
            if (filePath) {
              files.push({
                fileId: fileId,
                fileName: 'Photo.jpg',
                filePath: filePath,
                directLink: `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`,
                type: 'photo'
              });
            }
          }
          
          // Process videos
          if (message.video) {
            const fileId = message.video.file_id;
            const filePath = await getFilePath(fileId);
            
            if (filePath) {
              files.push({
                fileId: fileId,
                fileName: message.video.file_name || 'Video.mp4',
                filePath: filePath,
                directLink: `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`,
                type: 'video'
              });
            }
          }
        }
      }
    }
    
    res.json({ success: true, files: files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files from Telegram' });
  }
});

// Helper function to get file path from Telegram
async function getFilePath(fileId) {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    
    if (response.data.ok) {
      return response.data.result.file_path;
    }
  } catch (error) {
    console.error('Error getting file path:', error);
  }
  return null;
}

// Test endpoint without authentication
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is working!', 
    hasBotToken: !!BOT_TOKEN,
    timestamp: new Date().toISOString() 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// Error handler
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`BOT_TOKEN configured: ${!!BOT_TOKEN}`);
});});

// Error handler
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
