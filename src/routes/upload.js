import { Router } from "express";
// import axios from 'axios';
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import ytdl from "ytdl-core";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import upload from "../multer.js";
import { addToQueue } from "../index.js";

const execAsync = promisify(exec);

const ENV_FILE = `.env.${process.env.NODE_ENV || "local"}`;

dotenv.config({ path: ENV_FILE });

const router = Router();

const __filename = fileURLToPath(import.meta.url); // Convertir l'URL du module en chemin de fichier
const __dirname = path.dirname(__filename); // Obtenir le dossier du fichier

const YOUTUBE_COOKIES = process.env.YOUTUBE_COOKIES || "";
const YOUTUBE_PROXY_URL = process.env.YOUTUBE_PROXY_URL || "";

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
  const trimStart = parseInt(req.body.trimStart) || 0;
  const trimEnd = parseInt(req.body.trimEnd) || 0;

  const timestamp = Date.now();
  const tempPath = path.join(__dirname, "../../uploads", `${timestamp}_temp.mp4`);
  const finalPath = path.join(__dirname, "../../uploads", `${timestamp}.mp4`);

  try {
    console.log("Downloading YouTube video...");

    // Download the video using ytdl-core
    const ytdlOptions = {
      format: "mp4",
      quality: "highest",
      requestOptions: {
        headers: {
          Cookie: YOUTUBE_COOKIES,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      },
    };

    // Add proxy if configured
    if (YOUTUBE_PROXY_URL) {
      ytdlOptions.requestOptions.proxy = YOUTUBE_PROXY_URL;
      console.log("Using proxy for YouTube download:", YOUTUBE_PROXY_URL);
    }

    // Download to temp file
    await new Promise((resolve, reject) => {
      const video = ytdl(src, ytdlOptions);
      const writeStream = fs.createWriteStream(tempPath);

      video.on("error", reject);
      writeStream.on("error", reject);
      writeStream.on("finish", resolve);

      video.pipe(writeStream);
    });

    console.log("Video downloaded, processing...");

    // Trim with ffmpeg if needed
    if (trimStart > 0 || trimEnd > 0) {
      let ffmpegCmd = `ffmpeg -y -i "${tempPath}"`;

      if (trimStart > 0) {
        ffmpegCmd += ` -ss ${trimStart}`;
      }

      if (trimEnd > 0) {
        ffmpegCmd += ` -to ${trimEnd}`;
      }

      ffmpegCmd += ` -c copy "${finalPath}"`;

      console.log("Running ffmpeg:", ffmpegCmd);
      await execAsync(ffmpegCmd);

      // Delete temp file
      fs.unlinkSync(tempPath);
    } else {
      // No trim, just rename
      fs.renameSync(tempPath, finalPath);
    }

    console.log("Video processed successfully");

    addToQueue({
      type: "video",
      src: `${process.env.SERVER_URL}/uploads/${path.basename(finalPath)}`,
      caption,
      duration: 0,
    });

    res.status(200).json({
      success: true,
      src: `${process.env.SERVER_URL}/uploads/${path.basename(finalPath)}`,
      caption,
      duration: 0,
    });
  } catch (error) {
    console.error("Error:", error);
    // Cleanup on error
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    res.status(500).send("Error processing video");
  }
});

export default router;
