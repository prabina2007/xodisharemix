const mongoose = require('mongoose');

const songSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    artist: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['trending_latest', 'sound_check', 'private_track', 'bhajan_mix'],
      required: true,
    },
    imagePath: { type: String, required: true },
    songPath: { type: String, required: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Song', songSchema);