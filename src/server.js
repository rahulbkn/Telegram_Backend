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
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

// In-memory storage for files (for demo purposes)
// In production, use a proper database like MongoDB, PostgreSQL, etc.
let filesStorage = [];

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
    hasApiKey: !!API_KEY,
    totalFiles: filesStorage.length,
    webhookUrl: `${SERVER_URL}/webhook`
  });
});

// Get all files endpoint
app.get('/api/files', validateApiKey, async (req, res) => {
  try {
    // Fetch latest updates from Telegram to ensure we have current files
    await syncFilesFromTelegram();
    
    const activeFiles = filesStorage.filter(file => !file.isDeleted);
    
    res.json({ 
      success: true, 
      count: activeFiles.length,
      files: activeFiles 
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ 
      error: 'Failed to fetch files',
      message: error.message 
    });
  }
});

// Delete file endpoint
app.delete('/api/files/:fileId', validateApiKey, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const fileIndex = filesStorage.findIndex(file => file.fileId === fileId && !file.isDeleted);
    
    if (fileIndex === -1) {
      return res.status(404).json({ 
        error: 'File not found',
        message: 'The specified file ID does not exist' 
      });
    }
    
    filesStorage[fileIndex].isDeleted = true;
    
    res.json({ 
      success: true, 
      message: 'File deleted successfully',
      fileId: fileId
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ 
      error: 'Failed to delete file',
      message: error.message 
    });
  }
});

// Sync files from Telegram
async function syncFilesFromTelegram() {
  try {
    if (!BOT_TOKEN) return;
    
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100`
    );
    
    if (response.data.ok && response.data.result) {
      for (const update of response.data.result) {
        if (update.message) {
          await processMessage(update.message);
        }
      }
    }
  } catch (error) {
    console.error('Error syncing files from Telegram:', error);
  }
}

// Process Telegram message
async function processMessage(message) {
  try {
    let fileData = null;
    let fileType = '';
    let defaultName = '';

    if (message.document) {
      fileData = message.document;
      fileType = 'document';
      defaultName = fileData.file_name || 'Document';
    } else if (message.photo && message.photo.length > 0) {
      fileData = message.photo[message.photo.length - 1];
      fileType = 'photo';
      defaultName = 'Photo.jpg';
    } else if (message.video) {
      fileData = message.video;
      fileType = 'video';
      defaultName = message.video.file_name || 'Video.mp4';
    }

    if (fileData && !filesStorage.some(f => f.fileId === fileData.file_id)) {
      const filePath = await getFilePath(fileData.file_id);
      
      if (filePath) {
        filesStorage.push({
          fileId: fileData.file_id,
          fileName: defaultName,
          filePath: filePath,
          directLink: `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`,
          type: fileType,
          fileSize: fileData.file_size || null,
          createdAt: new Date().toISOString(),
          isDeleted: false
        });
        
        console.log('File added to storage:', fileData.file_id);
      }
    }
    
    // Handle delete commands
    if (message.text && message.text.startsWith('/delete')) {
      await handleDeleteCommand(message);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

// Webhook endpoint for Telegram updates
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received');
    
    if (req.body.message) {
      await processMessage(req.body.message);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

// Helper function to handle delete command
async function handleDeleteCommand(message) {
  try {
    const parts = message.text.split(' ');
    if (parts.length === 2) {
      const fileId = parts[1];
      const fileIndex = filesStorage.findIndex(file => file.fileId === fileId);
      
      if (fileIndex !== -1) {
        filesStorage[fileIndex].isDeleted = true;
        console.log('File marked as deleted via bot command:', fileId);
        await sendMessage(message.chat.id, `File ${fileId} has been deleted.`);
      } else {
        await sendMessage(message.chat.id, `File ${fileId} not found.`);
      }
    }
  } catch (error) {
    console.error('Error handling delete command:', error);
  }
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

// Helper function to send message
async function sendMessage(chatId, text) {
  try {
    await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`
    );
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Setup Telegram webhook
async function setupWebhook() {
  try {
    const webhookUrl = `${SERVER_URL}/webhook`;
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
    );
    console.log('Webhook setup result:', response.data);
  } catch (error) {
    console.error('Error setting up webhook:', error);
  }
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    availableEndpoints: [
      '/api/health', 
      '/api/files', 
      '/api/files/:fileId (DELETE)',
      '/webhook (POST)'
    ] 
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`BOT_TOKEN configured: ${!!BOT_TOKEN}`);
  console.log(`API_KEY configured: ${!!API_KEY}`);
  console.log(`Server URL: ${SERVER_URL}`);
  
  // Initial sync of files
  await syncFilesFromTelegram();
  console.log(`Initial sync completed. Found ${filesStorage.length} files`);
  
  // Setup webhook if SERVER_URL is configured
  if (SERVER_URL && SERVER_URL !== `http://localhost:${PORT}`) {
    await setupWebhook();
  }
});

module.exports = app;
