const express = require('express');
const { getFiles } = require('../controllers/fileController');

const router = express.Router();

router.get('/', getFiles);

module.exports = router;