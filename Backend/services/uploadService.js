// backend/services/uploadService.js
// Placeholder — wire up Cloudinary when needed
const uploadFile = async (filePath, folder = "reports") => {
  // TODO: integrate Cloudinary
  // const cloudinary = require("cloudinary").v2;
  // return await cloudinary.uploader.upload(filePath, { folder });
  return { url: filePath, public_id: null };
};

module.exports = { uploadFile };