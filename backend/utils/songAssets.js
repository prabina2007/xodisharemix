const fs = require('fs');
const path = require('path');
const cloudinary = require('../config/cloudinary');

const appRoot = path.resolve(__dirname, '..', '..');
const uploadsRoot = path.join(appRoot, 'backend', 'uploads');

const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_error) {
    // ignore cleanup failure
  }
};

const uploadToCloudinary = async (filePath, options = {}) => {
  if (!filePath) return null;
  return cloudinary.uploader.upload(filePath, options);
};

const deleteSongAssets = async (song) => {
  if (!song) return;

  const tasks = [];

  if (song.imagePublicId) {
    tasks.push(cloudinary.uploader.destroy(song.imagePublicId, { resource_type: 'image' }).catch(() => null));
  }

  if (song.songPublicId) {
    tasks.push(cloudinary.uploader.destroy(song.songPublicId, { resource_type: 'video' }).catch(() => null));
  }

  const maybeLocalPaths = [song.imagePath, song.songPath]
    .filter(Boolean)
    .filter((value) => typeof value === 'string' && value.startsWith('/uploads/'))
    .map((value) => path.join(uploadsRoot, value.replace(/^\/uploads\//, '').replace(/\//g, path.sep)));

  maybeLocalPaths.forEach((filePath) => tasks.push(Promise.resolve().then(() => safeUnlink(filePath))));

  await Promise.all(tasks);
};

module.exports = {
  safeUnlink,
  uploadToCloudinary,
  deleteSongAssets,
};
