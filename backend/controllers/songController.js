const path = require('path');
const { Readable } = require('stream');
const Song = require('../models/Song');
const cloudinary = require('../config/cloudinary');
const { validCategories } = require('../utils/upload');
const { safeUnlink, uploadToCloudinary } = require('../utils/songAssets');

const appRoot = path.resolve(__dirname, '..', '..');
const uploadsRoot = path.join(appRoot, 'backend', 'uploads');

const sanitizeFileSegment = (value) => String(value || '')
  .replace(/[<>:"/\\|?*]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getSongExtension = (songPath) => {
  try {
    const parsed = new URL(songPath);
    const ext = path.extname(parsed.pathname);
    return ext || '.mp3';
  } catch (_error) {
    return path.extname(songPath || '') || '.mp3';
  }
};

const buildDownloadName = (song, ext = '.mp3') => {
  const title = sanitizeFileSegment(song?.title || 'track');
  const artist = sanitizeFileSegment(song?.artist || 'artist');
  return `${title} - ${artist} - xodisharemix${ext}`;
};

const uploadSong = async (req, res) => {
  const imageFile = req.files?.image?.[0] || null;
  const songFile = req.files?.song?.[0] || null;

  try {
    const { title, artist } = req.body;
    const category = String(req.body.category || '').toLowerCase();

    if (!title || !artist || !category) {
      return res.status(400).json({ message: 'Title, artist, and category are required' });
    }

    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    if (!songFile) {
      return res.status(400).json({ message: 'Song file is required' });
    }

    let imagePath = '/assets/logo.jpg';
    let imagePublicId = '';

    if (imageFile) {
      const imageUpload = await uploadToCloudinary(imageFile.path, {
        folder: `xodisharemix/song_images/${category}`,
        resource_type: 'image',
      });
      imagePath = imageUpload.secure_url;
      imagePublicId = imageUpload.public_id;
    }

    const songUpload = await uploadToCloudinary(songFile.path, {
      folder: `xodisharemix/songs/${category}`,
      resource_type: 'video',
    });

    const created = await Song.create({
      title,
      artist,
      category,
      imagePath,
      imagePublicId,
      songPath: songUpload.secure_url,
      songPublicId: songUpload.public_id,
      uploader: req.user.id,
    });

    return res.status(201).json({
      message: 'Song uploaded successfully',
      song: created,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Song upload failed',
      error: error.message,
    });
  } finally {
    safeUnlink(imageFile?.path);
    safeUnlink(songFile?.path);
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
      error: error.message,
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
      error: error.message,
    });
  }
};

const getSongById = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id).populate('uploader', 'email');

    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    return res.status(200).json({ song });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch song',
      error: error.message,
    });
  }
};

const downloadSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);

    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    if (song.songPublicId) {
      const sourceResponse = await fetch(song.songPath);

      if (!sourceResponse.ok || !sourceResponse.body) {
        throw new Error('Unable to fetch song from cloud storage');
      }

      const ext = getSongExtension(song.songPath);
      const fileName = buildDownloadName(song, ext);
      res.setHeader('Content-Type', sourceResponse.headers.get('content-type') || 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      Readable.fromWeb(sourceResponse.body).pipe(res);
      return;
    }

    const relativeSongPath = song.songPath.replace(/^\/uploads\//, '').replace(/\//g, path.sep);
    const absPath = path.join(uploadsRoot, relativeSongPath);
    const fileName = buildDownloadName(song, path.extname(absPath) || '.mp3');
    return res.download(absPath, fileName);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to download song',
      error: error.message,
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
