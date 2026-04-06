const fs = require('fs');
const path = require('path');
const multer = require('multer');

const validCategories = ['trending_latest', 'sound_check', 'private_track', 'drop', 'bhajan_mix'];
const appRoot = path.resolve(__dirname, '..', '..');
const uploadsRoot = path.join(appRoot, 'backend', 'uploads');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const base = file.fieldname === 'image' ? 'song_images' : 'songs';
    const target = path.join(uploadsRoot, base, 'temp');
    ensureDir(target);
    cb(null, target);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.fieldname === 'image' && !file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image file is allowed for song image'));
  }
  if (file.fieldname === 'song' && !file.mimetype.startsWith('audio/')) {
    return cb(new Error('Only audio file is allowed for song file'));
  }
  cb(null, true);
};

const uploadSongAssets = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

module.exports = { uploadSongAssets, validCategories };

