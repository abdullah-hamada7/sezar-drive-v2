const multer = require('multer');
const config = require('../config');

// Local upload directory creation logic removed.
// S3 is used for all storage.

/**
 * Creates a multer upload middleware using memory storage.
 */
function createUploader() {
  const storage = multer.memoryStorage();

  const fileFilter = (req, file, cb) => {
    if (config.allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: config.maxFileSize },
  });
}

module.exports = { createUploader };
