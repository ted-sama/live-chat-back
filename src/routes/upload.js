import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import ytdl from "ytdl-core";
import upload from "../multer.js";
import { config } from "../config.js";
import { UPLOADS_DIR } from "../paths.js";
import { requireApiKey } from "../middleware/auth.js";
import { addToQueue } from "../index.js";

const router = Router();

router.use(requireApiKey);

const publicUrl = (filename) => `${config.serverUrl}/uploads/${filename}`;

// duration is in milliseconds
// default duration for images is 5 seconds, for videos is 0 (video original duration)

// POST /api/upload/image-by-file
router.post("/image-by-file", upload.single("src"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const src = publicUrl(req.file.filename);
  const caption = req.body.caption || "";
  const duration = parseInt(req.body.duration) || 5000;
  addToQueue({ type: "image", src, caption, duration });

  res.json({
    success: true,
    src,
    caption,
    duration,
  });
});

// POST /api/upload/image-by-link
router.post("/image-by-link", (req, res) => {
  const src = req.body.src;
  if (!src) return res.status(400).json({ error: "No src" });

  const caption = req.body.caption || "";
  const duration = parseInt(req.body.duration) || 5000;
  addToQueue({ type: "image", src, caption, duration });

  res.json({
    success: true,
    src,
    caption,
    duration,
  });
});

// POST /api/upload/video-by-file
router.post("/video-by-file", upload.single("src"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const src = publicUrl(req.file.filename);
  const caption = req.body.caption || "";
  const duration = parseInt(req.body.duration) || 0;
  addToQueue({ type: "video", src, caption, duration });

  res.json({
    success: true,
    src,
    caption,
    duration,
  });
});

// POST /api/upload/video-by-link
router.post("/video-by-link", (req, res) => {
  const src = req.body.src;
  if (!src) return res.status(400).json({ error: "No src" });

  const caption = req.body.caption || "";
  const duration = parseInt(req.body.duration) || 0;
  addToQueue({ type: "video", src, caption, duration });

  res.json({
    success: true,
    src,
    caption,
    duration,
  });
});

// POST /api/upload/video-by-link/youtube
router.post("/video-by-link/youtube", async (req, res) => {
  const src = req.body.src;
  if (!src)
    return res.status(400).json({ error: "YouTube video URL is required" });

  if (!ytdl.validateURL(src))
    return res.status(400).json({ error: "Invalid YouTube video URL" });

  const caption = req.body.caption || "";
  const duration = parseInt(req.body.duration) || 0;

  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.mp4`;
  const videoPath = path.join(UPLOADS_DIR, filename);
  const writeStream = fs.createWriteStream(videoPath);

  let settled = false;
  const fail = (status, message, error) => {
    if (settled) return;
    settled = true;
    if (error) console.error(message, error);
    video.destroy();
    writeStream.destroy();
    fs.unlink(videoPath, () => {});
    res.status(status).json({ error: message });
  };

  const video = ytdl(src, {
    format: "mp4",
    quality: "highest",
    requestOptions: {
      headers: {
        Cookie: config.youtube.cookies,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    },
  });

  let downloaded = 0;
  video.on("data", (chunk) => {
    downloaded += chunk.length;
    if (downloaded > config.youtube.maxBytes) {
      fail(
        413,
        `YouTube video exceeds the ${Math.floor(config.youtube.maxBytes / 1048576)}MB limit`
      );
    }
  });

  video.on("error", (err) => fail(502, "Error downloading video", err));
  writeStream.on("error", (err) => fail(500, "Error writing video", err));

  writeStream.on("finish", () => {
    if (settled) return;
    settled = true;

    const publicSrc = publicUrl(filename);
    console.log("Video downloaded successfully");
    addToQueue({ type: "video", src: publicSrc, caption, duration });

    res.status(200).json({
      success: true,
      src: publicSrc,
      caption,
      duration,
    });
  });

  video.pipe(writeStream);
});

export default router;
