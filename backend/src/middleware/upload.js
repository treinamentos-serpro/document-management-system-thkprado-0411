const { randomUUID } = require('node:crypto');
const { mkdir } = require('node:fs');
const path = require('node:path');
const multer = require('multer');

const storageDirectory = path.resolve(__dirname, '../../storage');

const storage = multer.diskStorage({
  destination(req, file, callback) {
    mkdir(storageDirectory, { recursive: true }, (error) => {
      callback(error, storageDirectory);
    });
  },
  filename(req, file, callback) {
    callback(null, randomUUID());
  },
});

module.exports = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
}).single('file');
