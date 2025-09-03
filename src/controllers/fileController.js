const telegramAPI = require("../utils/telegramApi");

const getFiles = async (req, res) => {
  try {
    const files = await telegramAPI.getAllFiles();
    res.json({ success: true, count: files.length, files });
  } catch (error) {
    console.error("Error in getFiles:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
};

const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const deleted = await telegramAPI.deleteFilePermanently(fileId);
    
    if (deleted) {
      res.json({ success: true, message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
};

module.exports = {
  getFiles,
  deleteFile
};
