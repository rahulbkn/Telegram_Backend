const express = require('express');
const { getFiles, deleteFile } = require('../controllers/fileController');

const router = express.Router();

router.get('/', getFiles);
router.delete('/:fileId', deleteFile);

module.exports = router;
