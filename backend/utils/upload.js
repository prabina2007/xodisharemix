const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.fieldname === "image") {
      return {
        folder: "xodisharemix/images",
        allowed_formats: ["jpg", "png", "jpeg"]
      };
    }

    if (file.fieldname === "song") {
      return {
        folder: "xodisharemix/songs",
        resource_type: "video"
      };
    }
  }
});

const uploadSongAssets = multer({ storage });

module.exports = { uploadSongAssets };