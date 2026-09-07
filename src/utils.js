import Ffmpeg from "fluent-ffmpeg";
import path from "path";
import { config } from "./config.js";
import { UPLOADS_DIR } from "./paths.js";

// Locally hosted media is probed straight from disk instead of travelling back
// through the public tunnel.
const resolveProbeTarget = (src) => {
  const prefix = `${config.serverUrl}/uploads/`;
  if (!src.startsWith(prefix)) return src;

  const filename = path.basename(src.slice(prefix.length));
  return path.join(UPLOADS_DIR, filename);
};

export const getVideoDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    Ffmpeg.ffprobe(resolveProbeTarget(videoPath), (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
};
