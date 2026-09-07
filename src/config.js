import "./env.js";

const int = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MINUTE = 60 * 1000;
const MB = 1024 * 1024;

export const config = {
  port: int(process.env.PORT, 3000),
  serverUrl: process.env.SERVER_URL || `http://localhost:${int(process.env.PORT, 3000)}`,
  apiKey: process.env.API_KEY || "",
  corsOrigins: (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  upload: {
    maxBytes: int(process.env.UPLOAD_MAX_BYTES, 90 * MB),
    ttlMs: int(process.env.UPLOAD_TTL_MINUTES, 120) * MINUTE,
    maxTotalBytes: int(process.env.UPLOAD_MAX_TOTAL_BYTES, 5 * 1024 * MB),
    sweepIntervalMs: int(process.env.CLEANUP_INTERVAL_MINUTES, 10) * MINUTE,
  },
  youtube: {
    maxBytes: int(process.env.YTDL_MAX_BYTES, 500 * MB),
    cookies: process.env.YOUTUBE_COOKIES || "",
  },
};
