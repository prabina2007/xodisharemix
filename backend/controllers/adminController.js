const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Song = require('../models/Song');
const { deleteSongAssets } = require('../utils/songAssets');

const adminLogin = (req, res) => {
  const { username, password } = req.body;

  if (username !== 'admin' || password !== 'prabina@2007') {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }

  const token = jwt.sign({ id: 'admin', role: 'admin', username: 'admin' }, process.env.JWT_SECRET, {
    expiresIn: '12h',
  });

  return res.status(200).json({ message: 'Admin login successful', token });
};

const listUsers = async (_req, res) => {
  try {
    const users = await User.find({}, '-password -otpCode -otpExpires').sort({ createdAt: -1 });
    return res.status(200).json({ users });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'User not found' });
    }

    const songs = await Song.find({ uploader: req.params.id });
    await Promise.all(songs.map((song) => deleteSongAssets(song)));
    await Song.deleteMany({ uploader: req.params.id });

    return res.status(200).json({ message: 'User and related songs deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
};

const listSongs = async (_req, res) => {
  try {
    const songs = await Song.find({}).populate('uploader', 'email').sort({ createdAt: -1 });
    return res.status(200).json({ songs });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch songs', error: error.message });
  }
};

const deleteSong = async (req, res) => {
  try {
    const deleted = await Song.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Song not found' });
    }

    await deleteSongAssets(deleted);
    return res.status(200).json({ message: 'Song deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete song', error: error.message });
  }
};

module.exports = {
  adminLogin,
  listUsers,
  deleteUser,
  listSongs,
  deleteSong,
};
