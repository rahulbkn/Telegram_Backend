const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const API_KEY = process.env.API_KEY;

// API Key validation middleware
const validateApiKey = (req, res, next) => {
  const clientApiKey = req.headers['x-api-key'];
  
  if (!clientApiKey) {
    return res.status(401).json({ 
      error: 'API key required',
      message: 'Please include x-api-key header' 
    });
  }
  
  if (clientApiKey !== API_KEY) {
    return res.status(401).json({ 
      error: 'Invalid API key',
      message: 'The provided API key is not valid' 
    });
  }
  
  console.log('API Key validation successful');
  next();
};

// Health endpoint (no API key required)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    server: 'Render',
    timestamp: new Date().toISOString(),
    hasBotToken: !!BOT_TOKEN,
    hasApiKey: !!API_KEY
  });
});

// Files endpoint (requires API key)
app.get('/api/files', validateApiKey, async (req, res) => {
  try {
    if (!BOT_TOKEN) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Bot token not configured on server' 
      });
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
          
          // Process different file types
          if (message.document) {
            const filePath = await getFilePath(message.document.file_id);
            if (filePath) {
              files.push(createFileObject(message.document, filePath, 'document'));
            }
          }
          
          if (message.photo && message.photo.length > 0) {
            const largestPhoto = message.photo[message.photo.length - 1];
            const filePath = await getFilePath(largestPhoto.file_id);
            if (filePath) {
              files.push(createFileObject(largestPhoto, filePath, 'photo', 'Photo.jpg'));
            }
          }
          
          if (message.video) {
            const filePath = await getFilePath(message.video.file_id);
            if (filePath) {
              files.push(createFileObject(message.video, filePath, 'video'));
            }
          }
        }
      }
    }
    
    res.json({ 
      success: true, 
      count: files.length,
      files: files 
    });
    
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ 
      error: 'Failed to fetch files',
      message: error.message 
    });
  }
});

// Helper function to create file object
function createFileObject(fileData, filePath, type, defaultName = null) {
  return {
    fileId: fileData.file_id,
    fileName: fileData.file_name || defaultName || 'File',
    filePath: filePath,
    directLink: `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`,
    type: type,
    fileSize: fileData.file_size || null
  };
}

// Helper function to get file path
async function getFilePath(fileId) {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    return response.data.ok ? response.data.result.file_path : null;
  } catch (error) {
    console.error('Error getting file path:', error);
    return null;
  }
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    availableEndpoints: ['/api/health', '/api/files'] 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`BOT_TOKEN configured: ${!!BOT_TOKEN}`);
  console.log(`API_KEY configured: ${!!API_KEY}`);
});
