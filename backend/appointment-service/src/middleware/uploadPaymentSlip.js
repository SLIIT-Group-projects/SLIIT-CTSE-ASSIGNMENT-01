const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join("/app/uploads/payment-slips");

/* ensure directory exists */
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

module.exports = upload;