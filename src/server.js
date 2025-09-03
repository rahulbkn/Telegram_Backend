const express = require('express');
const axios = require('axios');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
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

// Initialize SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Create files table if not exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fileId TEXT UNIQUE,
    fileName TEXT,
    filePath TEXT,
    type TEXT,
    fileSize INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    isDeleted BOOLEAN DEFAULT FALSE
  )`);
});

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
    webhookUrl: `${SERVER_URL}/webhook`
  });
});

// Get all files endpoint
app.get('/api/files', validateApiKey, async (req, res) => {
  try {
    db.all(
      'SELECT * FROM files WHERE isDeleted = FALSE ORDER BY createdAt DESC',
      (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Database error',
            message: err.message 
          });
        }

        const files = rows.map(row => ({
          fileId: row.fileId,
          fileName: row.fileName,
          filePath: row.filePath,
          directLink: `https://api.telegram.org/file/bot${BOT_TOKEN}/${row.filePath}`,
          type: row.type,
          fileSize: row.fileSize,
          createdAt: row.createdAt
        }));

        res.json({ 
          success: true, 
          count: files.length,
          files: files 
        });
      }
    );
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
    
    db.run(
      'UPDATE files SET isDeleted = TRUE WHERE fileId = ?',
      [fileId],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Database error',
            message: err.message 
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({ 
            error: 'File not found',
            message: 'The specified file ID does not exist' 
          });
        }

        res.json({ 
          success: true, 
          message: 'File deleted successfully',
          fileId: fileId
        });
      }
    );
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ 
      error: 'Failed to delete file',
      message: error.message 
    });
  }
});

// Webhook endpoint for Telegram updates
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', req.body);
    
    if (req.body.message) {
      const message = req.body.message;
      
      // Handle new files
      if (message.document || message.photo || message.video) {
        await handleNewFile(message);
      }
      
      // Handle delete commands
      if (message.text && message.text.startsWith('/delete')) {
        await handleDeleteCommand(message);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

// Helper function to handle new file
async function handleNewFile(message) {
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

    if (fileData) {
      const filePath = await getFilePath(fileData.file_id);
      
      if (filePath) {
        db.run(
          `INSERT OR REPLACE INTO files (fileId, fileName, filePath, type, fileSize) 
           VALUES (?, ?, ?, ?, ?)`,
          [fileData.file_id, defaultName, filePath, fileType, fileData.file_size],
          function(err) {
            if (err) {
              console.error('Error saving file to database:', err);
            } else {
              console.log('File saved to database:', fileData.file_id);
            }
          }
        );
      }
    }
  } catch (error) {
    console.error('Error handling new file:', error);
  }
}

// Helper function to handle delete command
async function handleDeleteCommand(message) {
  try {
    const parts = message.text.split(' ');
    if (parts.length === 2) {
      const fileId = parts[1];
      
      db.run(
        'UPDATE files SET isDeleted = TRUE WHERE fileId = ?',
        [fileId],
        function(err) {
          if (err) {
            console.error('Error deleting file:', err);
          } else if (this.changes > 0) {
            console.log('File marked as deleted:', fileId);
            sendMessage(message.chat.id, `File ${fileId} has been deleted.`);
          } else {
            sendMessage(message.chat.id, `File ${fileId} not found.`);
          }
        }
      );
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
  
  // Setup webhook
  await setupWebhook();
});

// Close database connection on exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});

module.exports = app;
