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

router.get('/', getSongs);
router.get('/recent', getRecentSongs);
router.get('/:id', getSongById);
router.get('/:id/download', downloadSong);
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