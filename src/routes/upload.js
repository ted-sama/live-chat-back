import { Router } from "express";
// import axios from 'axios';
import fs from "fs";
import path from "path";
import ytdl from "ytdl-core";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import upload from "../multer.js";
import { addToQueue } from "../index.js";

const ENV_FILE = `.env.${process.env.NODE_ENV || "local"}`;

dotenv.config({ path: ENV_FILE });

const router = Router();

const __filename = fileURLToPath(import.meta.url); // Convertir l'URL du module en chemin de fichier
const __dirname = path.dirname(__filename); // Obtenir le dossier du fichier

const YOUTUBE_COOKIES = process.env.YOUTUBE_COOKIES || "";

// duration is in milliseconds
// default duration for images is 5 seconds, for videos is 0 (video original duration)

// POST /api/upload/image-by-file
router.post("/image-by-file", upload.single("src"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const src = `${process.env.SERVER_URL}/uploads/${req.file.filename}`;
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

  const src = `${process.env.SERVER_URL}/uploads/${req.file.filename}`;
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

  const caption = req.body.caption || "";
  const duration = parseInt(req.body.duration) || 0;

  try {
    // Save the video to disk root/uploads folder with a random name
    const videoPath = path.join(
      __dirname,
      "../../uploads",
      `${Date.now()}.mp4`
    );
    const writeStream = fs.createWriteStream(videoPath);

    // Download the video using ytdl-core
    const video = ytdl(src, {
      format: "mp4",
      quality: "highest",
      requestOptions: {
        headers: {
          Cookie: YOUTUBE_COOKIES,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      },
    });

    // Handle download errors
    video.on("error", (err) => {
      console.error("Error downloading video:", err);
      res.status(500).send("Error downloading video");
    });

    // Save file
    video.pipe(writeStream);

    writeStream.on("error", (err) => {
      console.error("Error downloading video:", err);
      res.status(500).send("Error downloading video");
    });

    writeStream.on("finish", () => {
      console.log("Video downloaded successfully");
      addToQueue({
        type: "video",
        src: `${process.env.SERVER_URL}/uploads/${path.basename(videoPath)}`,
        caption,
        duration,
      });
      res.status(200).json({
        success: true,
        src: `${process.env.SERVER_URL}/uploads/${path.basename(videoPath)}`,
        caption,
        duration,
      });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error downloading video");
  }
});

export default router;
