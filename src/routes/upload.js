import { Router } from "express";
// import axios from 'axios';
import fs from "fs";
import path from "path";
import ytdl from "ytdl-core";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import upload from "../multer.js";
import { addToQueue } from "../index.js";

const ENV_FILE = `.env.${process.env.NODE_ENV || 'local'}`;

dotenv.config({ path: ENV_FILE });

const router = Router();

const __filename = fileURLToPath(import.meta.url); // Convertir l'URL du module en chemin de fichier
const __dirname = path.dirname(__filename); // Obtenir le dossier du fichier

// POST /api/upload/image-by-file
router.post("/image-by-file", upload.single("src"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const src = `${process.env.SERVER_URL}/uploads/${req.file.filename}`;
  const caption = req.body.caption || "";
  addToQueue({ type: "image", src, caption });

  res.json({
    success: true,
    src,
    caption,
  });
});

// POST /api/upload/image-by-link
router.post("/image-by-link", (req, res) => {
  const src = req.body.src;
  if (!src) return res.status(400).json({ error: "No file" });

  const caption = req.body.caption || "";
  addToQueue({ type: "image", src, caption });

  res.json({
    success: true,
    src,
    caption,
  });
});

// POST /api/upload/video-by-file
router.post("/video-by-file", upload.single("src"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const src = `${process.env.SERVER_URL}/uploads/${req.file.filename}`;
  const caption = req.body.caption || "";
  addToQueue({ type: "video", src, caption });

  res.json({
    success: true,
    src,
    caption,
  });
});

// POST /api/upload/video-by-link/youtube
router.post("/video-by-link/youtube", async (req, res) => {
  const src = req.body.src;
  if (!src)
    return res.status(400).json({ error: "YouTube video URL is required" });

  const caption = req.body.caption || "";

  try {
    // Download the video using ytdl-core
    const video = ytdl(src, {
      format: "mp4",
      quality: "highest",
    });

    // Save the video to disk root/uploads folder with a random name
    const videoPath = path.join(
      __dirname,
      "../../uploads",
      `${Date.now()}.mp4`
    );
    const writeStream = fs.createWriteStream(videoPath);

    video.pipe(writeStream);

    writeStream.on("finish", () => {
      console.log("Video downloaded successfully");
      addToQueue({
        type: "video",
        src: `${process.env.SERVER_URL}/uploads/${path.basename(videoPath)}`,
        caption,
      });
      res
        .status(200)
        .json({
          success: true,
          src: `${process.env.SERVER_URL}/uploads/${path.basename(videoPath)}`,
        });
    });

    writeStream.on("error", (err) => {
      console.error("Error downloading video:", err);
      res.status(500).send("Error downloading video");
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error downloading video");
  }
});

export default router;
