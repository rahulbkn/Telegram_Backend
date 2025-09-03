File fetch = require("node-fetch");
const db = require("../File");

const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Initialize webhook for real-time updates
async function setupWebhook(webhookUrl) {
  try {
    const url = `${BASE_URL}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log('Webhook setup:', data);
    return data;
  } catch (err) {
    console.error("Error setting up webhook:", err);
  }
}

// Process incoming webhook update
async function processUpdate(update) {
  if (update.message) {
    const message = update.message;
    
    // Handle new files
    if (message.document || message.photo || message.video) {
      await handleNewFile(message);
    }
    
    // Handle delete commands
    if (message.text && message.text.startsWith('/delete')) {
      await handleDeleteCommand(message);
    }
  }
}

// Handle new file upload
async function handleNewFile(message) {
  let fileData = null;
  let fileType = '';

  if (message.document) {
    fileData = message.document;
    fileType = 'document';
  } else if (message.photo) {
    fileData = message.photo[message.photo.length - 1];
    fileType = 'photo';
  } else if (message.video) {
    fileData = message.video;
    fileType = 'video';
  }

  if (fileData) {
    const filePath = await getFilePath(fileData.file_id);
    
    db.run(
      `INSERT OR REPLACE INTO files (fileId, fileName, filePath, type, fileSize) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        fileData.file_id,
        fileData.file_name || `${fileType}.${getFileExtension(fileType)}`,
        filePath,
        fileType,
        fileData.file_size
      ],
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

// Handle delete command
async function handleDeleteCommand(message) {
  const parts = message.text.split(' ');
  if (parts.length === 2) {
    const fileId = parts[1];
    
    db.run(
      'UPDATE files SET isDeleted = TRUE WHERE fileId = ?',
      [fileId],
      function(err) {
        if (err) {
          console.error('Error deleting file:', err);
        } else {
          console.log('File marked as deleted:', fileId);
          // Send confirmation message
          sendMessage(message.chat.id, `File ${fileId} has been deleted.`);
        }
      }
    );
  }
}

// Get all active files from database
async function getAllFiles() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM files WHERE isDeleted = FALSE ORDER BY createdAt DESC',
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            ...row,
            directLink: `https://api.telegram.org/file/bot${BOT_TOKEN}/${row.filePath}`
          })));
        }
      }
    );
  });
}

// Delete file permanently
async function deleteFilePermanently(fileId) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM files WHERE fileId = ?',
      [fileId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      }
    );
  });
}

// Helper function to get file path
async function getFilePath(fileId) {
  try {
    const url = `${BASE_URL}/getFile?file_id=${fileId}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.ok ? data.result.file_path : null;
  } catch (err) {
    console.error("Error getting file path:", err);
    return null;
  }
}

// Helper function to send message
async function sendMessage(chatId, text) {
  try {
    const url = `${BASE_URL}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`;
    await fetch(url);
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

// Helper function to get file extension
function getFileExtension(type) {
  const extensions = {
    document: 'bin',
    photo: 'jpg',
    video: 'mp4',
    audio: 'mp3',
    voice: 'ogg'
  };
  return extensions[type] || 'bin';
}

module.exports = {
  setupWebhook,
  processUpdate,
  getAllFiles,
  deleteFilePermanently,
  getFilePath
};
