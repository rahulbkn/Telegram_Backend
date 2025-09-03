const telegramAPI = require('../utils/telegramApi');

const getFiles = async (req, res) => {
  try {
    const updates = await telegramAPI.getUpdates(20);
    const files = [];
    
    if (!updates.ok) {
      return res.status(500).json({ error: 'Failed to fetch updates from Telegram' });
    }
    
    for (const update of updates.result) {
      if (update.message) {
        const message = update.message;
        
        // Process documents
        if (message.document) {
          const filePath = await telegramAPI.getFilePath(message.document.file_id);
          if (filePath) {
            files.push({
              fileId: message.document.file_id,
              fileName: message.document.file_name || 'Document',
              filePath: filePath,
              directLink: `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`,
              type: 'document'
            });
          }
        }
        
        // Process photos
        if (message.photo) {
          const largestPhoto = message.photo[message.photo.length - 1];
          const filePath = await telegramAPI.getFilePath(largestPhoto.file_id);
          if (filePath) {
            files.push({
              fileId: largestPhoto.file_id,
              fileName: 'Photo.jpg',
              filePath: filePath,
              directLink: `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`,
              type: 'photo'
            });
          }
        }
        
        // Process videos
        if (message.video) {
          const filePath = await telegramAPI.getFilePath(message.video.file_id);
          if (filePath) {
            files.push({
              fileId: message.video.file_id,
              fileName: message.video.file_name || 'Video.mp4',
              filePath: filePath,
              directLink: `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`,
              type: 'video'
            });
          }
        }
      }
    }
    
    res.json({ success: true, files: files });
  } catch (error) {
    console.error('Error in getFiles:', error);
    res.status(500).json({ error: 'Failed to process files' });
  }
};

module.exports = {
  getFiles
};