const telegramAPI = require("../utils/telegramApi");

const getFiles = async (req, res) => {
  try {
    const updates = await telegramAPI.getAllUpdates(); // Changed to getAllUpdates
    const files = [];
    const processedFileIds = new Set(); // To avoid duplicates

    if (!updates.ok) {
      return res.status(500).json({ error: "Failed to fetch updates from Telegram" });
    }

    console.log(`Processing ${updates.result.length} updates...`);

    for (const update of updates.result) {
      if (update.message) {
        const message = update.message;

        // Documents
        if (message.document && !processedFileIds.has(message.document.file_id)) {
          const filePath = await telegramAPI.getFilePath(message.document.file_id);
          if (filePath) {
            files.push({
              fileId: message.document.file_id,
              fileName: message.document.file_name || "Document",
              filePath,
              directLink: `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`,
              type: "document",
              fileSize: message.document.file_size || null
            });
            processedFileIds.add(message.document.file_id);
          }
        }

        // Photos
        if (message.photo) {
          const largestPhoto = message.photo[message.photo.length - 1];
          if (!processedFileIds.has(largestPhoto.file_id)) {
            const filePath = await telegramAPI.getFilePath(largestPhoto.file_id);
            if (filePath) {
              files.push({
                fileId: largestPhoto.file_id,
                fileName: "Photo.jpg",
                filePath,
                directLink: `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`,
                type: "photo",
                fileSize: largestPhoto.file_size || null
              });
              processedFileIds.add(largestPhoto.file_id);
            }
          }
        }

        // Videos
        if (message.video && !processedFileIds.has(message.video.file_id)) {
          const filePath = await telegramAPI.getFilePath(message.video.file_id);
          if (filePath) {
            files.push({
              fileId: message.video.file_id,
              fileName: message.video.file_name || "Video.mp4",
              filePath,
              directLink: `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`,
              type: "video",
              fileSize: message.video.file_size || null
            });
            processedFileIds.add(message.video.file_id);
          }
        }

        // Add more file types if needed
        if (message.audio && !processedFileIds.has(message.audio.file_id)) {
          const filePath = await telegramAPI.getFilePath(message.audio.file_id);
          if (filePath) {
            files.push({
              fileId: message.audio.file_id,
              fileName: message.audio.file_name || "Audio",
              filePath,
              directLink: `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`,
              type: "audio",
              fileSize: message.audio.file_size || null
            });
            processedFileIds.add(message.audio.file_id);
          }
        }
      }
    }

    console.log(`Found ${files.length} unique files`);
    res.json({ success: true, count: files.length, files });
  } catch (error) {
    console.error("Error in getFiles:", error);
    res.status(500).json({ error: "Failed to process files" });
  }
};

module.exports = {
  getFiles,
};
