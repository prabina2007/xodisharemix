const Song = require('../models/Song');
const { validCategories } = require('../utils/upload');

const uploadSong = async (req, res) => {
  try {
    const { title, artist } = req.body;
    const category = String(req.body.category || '').toLowerCase();

    if (!title || !artist || !category) {
      return res.status(400).json({ message: 'Title, artist, and category are required' });
    }

    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    if (!req.files || !req.files.image || !req.files.song) {
      return res.status(400).json({ message: 'Image and song files are required' });
    }

    const imageFile = req.files.image[0];
    const songFile = req.files.song[0];

    // Cloudinary returns secure URLs automatically
    const imagePath = imageFile.path;
    const songPath = songFile.path;

    const created = await Song.create({
      title,
      artist,
      category,
      imagePath,
      songPath,
      uploader: req.user.id,
    });

    return res.status(201).json({
      message: 'Song uploaded successfully',
      song: created
    });

  } catch (error) {
    return res.status(500).json({
      message: 'Song upload failed',
      error: error.message
    });
  }
};

const getSongs = async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};

    if (category && validCategories.includes(category)) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { artist: { $regex: search, $options: 'i' } },
      ];
    }

    const songs = await Song.find(query)
      .populate('uploader', 'email')
      .sort({ createdAt: -1 });

    return res.status(200).json({ songs });

  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch songs',
      error: error.message
    });
  }
};

const getRecentSongs = async (_req, res) => {
  try {
    const songs = await Song.find({})
      .sort({ createdAt: -1 })
      .limit(12);

    return res.status(200).json({ songs });

  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch recent songs',
      error: error.message
    });
  }
};

const getSongById = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .populate('uploader', 'email');

    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    return res.status(200).json({ song });

  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch song',
      error: error.message
    });
  }
};

const downloadSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);

    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Redirect to Cloudinary file
    return res.redirect(song.songPath);

  } catch (error) {
    return res.status(500).json({
      message: 'Failed to download song',
      error: error.message
    });
  }
};

module.exports = {
  uploadSong,
  getSongs,
  getRecentSongs,
  getSongById,
  downloadSong,
};