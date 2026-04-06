const mongoose = require('mongoose');

const songSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    artist: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['trending_latest', 'sound_check', 'private_track', 'drop', 'bhajan_mix'],
      required: true,
    },
    imagePath: { type: String, default: '/assets/logo.jpg' },
    imagePublicId: { type: String, default: '' },
    songPath: { type: String, required: true },
    songPublicId: { type: String, default: '' },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Song', songSchema);

