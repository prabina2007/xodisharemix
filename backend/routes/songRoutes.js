const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadSongAssets } = require('../utils/upload');
const {
  uploadSong,
  getSongs,
  getRecentSongs,
  getSongById,
  downloadSong,
} = require('../controllers/songController');

const router = express.Router();

// Get all songs
router.get('/', getSongs);

// Get recent songs
router.get('/recent', getRecentSongs);

// Get song by ID
router.get('/:id', getSongById);

// Download song
router.get('/:id/download', downloadSong);

// Upload song
router.post(
  '/upload',
  authMiddleware,
  uploadSongAssets.fields([
    { name: 'image', maxCount: 1 },
    { name: 'song', maxCount: 1 },
  ]),
  uploadSong
);

module.exports = router;
