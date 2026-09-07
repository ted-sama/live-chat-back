import multer from "multer";
import path from "path";
import crypto from "crypto";
import { config } from "./config.js";
import { UPLOADS_DIR } from "./paths.js";

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".mkv",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const isMediaMime = /^(image|video)\//.test(file.mimetype);

  if (!isMediaMime || !ALLOWED_EXTENSIONS.has(extension)) {
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "src"));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxBytes, files: 1, fields: 10 },
});

export default upload;
