import express from "express";
import http from "http";
import cors from "cors";
import multer from "multer";
import { Server } from "socket.io";
import { config } from "./config.js";
import { UPLOADS_DIR } from "./paths.js";
import { purgeUploads, startUploadsJanitor, uploadsUsage } from "./cleanup.js";
import uploadRouter from "./routes/upload.js";
import { getVideoDuration } from "./utils.js";

if (process.env.NODE_ENV === "production" && !config.apiKey) {
  console.error("API_KEY is required when NODE_ENV=production");
  process.exit(1);
}

// The queue lives in memory, so leftovers from a previous run can never be played.
await purgeUploads(UPLOADS_DIR);
startUploadsJanitor(UPLOADS_DIR, config.upload);

// Queue logic
const queue = [];
let isPlaying = false;

export const addToQueue = ({ type, src, caption, duration }) => {
  queue.push({
    type,
    src,
    caption,
    duration,
  });

  console.log("Item added to queue:", queue.length);

  if (!isPlaying) {
    playQueue();
  }
};

const playQueue = async () => {
  if (queue.length === 0) {
    console.log("Queue is empty, waiting...");
    return;
  }

  if (isPlaying) {
    console.log("Already playing, skipping...");
    return;
  }

  const item = queue.shift();
  console.log("Playing:", item);

  let delay = 0;

  isPlaying = true;

  if (item.type === "image" || item.type === "video") {
    io.emit("play", item);

    if (item.type === "image") {
      delay = item.duration + 1000;
    } else if (item.type === "video") {
      let duration = 0;

      try {
        duration = await getVideoDuration(item.src);
      } catch (error) {
        console.error("Error getting video duration:", error);
      }

      if (item.duration === 0) {
        delay = duration * 1000 + 1000;
      } else {
        delay = item.duration + 1000;
      }
    }
  }

  setTimeout(() => {
    isPlaying = false;
    console.log("Finished playing, next item...");
    playQueue();
  }, delay);
};

const corsOrigin = config.corsOrigins.includes("*") ? "*" : config.corsOrigins;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
});

// Middleware
app.set("trust proxy", 1);
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    index: false,
    dotfiles: "ignore",
    maxAge: "1h",
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  })
);

// API routes
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/health", async (req, res) => {
  const uploads = await uploadsUsage(UPLOADS_DIR);
  res.json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    queue: queue.length,
    isPlaying,
    uploads,
  });
});

app.use("/api/upload", uploadRouter);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 415;
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `File too large (max ${Math.floor(config.upload.maxBytes / 1048576)}MB)`
        : "Unsupported file type";
    return res.status(status).json({ error: message });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Socket.io
io.on("connection", (socket) => {
  console.log(`user connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`user disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(config.port, "0.0.0.0", () => {
  console.log(`Server is running on ${config.serverUrl} (port ${config.port})`);
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
