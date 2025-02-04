import Ffmpeg from "fluent-ffmpeg";

export const getVideoDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    Ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
};
