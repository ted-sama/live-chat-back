import express from "express";
import http, { get } from "http";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { Server } from "socket.io";
import uploadRouter from "./routes/upload.js";
import { fileURLToPath } from "url";
import { getVideoDuration } from "./utils.js";

const ENV_FILE = `.env.${process.env.NODE_ENV || 'local'}`;

dotenv.config({ path: ENV_FILE });

// Clear upload folder on server start
// const directory = path.join(
//   path.dirname(fileURLToPath(import.meta.url)),
//   "../uploads"
// );
// fs.readdir(directory, (err, files) => {
//   if (err) throw err;

//   for (const file of files) {
//     fs.unlink(path.join(directory, file), (err) => {
//       if (err) throw err;
//     });
//   }
// });

const __filename = fileURLToPath(import.meta.url); // Convertir l'URL du module en chemin de fichier
const __dirname = path.dirname(__filename); // Obtenir le dossier du fichier

// Queue logic
const queue = [];

export const addToQueue = ({ type, src, caption }) => {
  queue.push({
    type,
    src,
    caption,
  });

  console.log("Item added to queue:", queue);

  if (!isPlaying) {
    playQueue();
  }
};

let isPlaying = false;

const playQueue = () => {
  console.log("playQueue: Queue length", queue.length);
  console.log("Queue:", queue);

  // Si la queue est vide, arrêter la fonction
  if (queue.length === 0) {
    console.log("Queue is empty, waiting...");
    return; // Queue vide, rien à jouer
  }

  // Si un élément est déjà en train de jouer, on n'entre pas dans la fonction
  if (isPlaying) {
    console.log("Already playing, skipping...");
    return;
  }

  // Récupérer et retirer le premier élément de la queue
  const item = queue.shift();
  console.log("Playing:", item); // Devrait s'afficher quand un élément est pris en charge

  let delay = 6500; // Par défaut, attendre 5 secondes

  isPlaying = true; // Marque l'état comme étant "en train de jouer"

  // Si c'est une image ou une vidéo, émettre un événement
  if (item.type === "image" || item.type === "video") {
    console.log("Item to play:", item); // Assure-toi que l'item est bien un objet valide
    io.emit("play", item);

    // Si c'est une vidéo, ajuster le délai selon la durée de la vidéo
    if (item.type === "video") {
      getVideoDuration(item.src).then((duration) => {
        console.log("Video duration:", duration);
        delay = duration * 1000 + 1000; // Durée vidéo + 1 seconde
      });
    }
  }

  // Une fois le délai écoulé, relancer la fonction playQueue
  setTimeout(() => {
    isPlaying = false; // Libère l'état "en train de jouer"
    console.log("Finished playing, next item...");
    playQueue(); // Relance la fonction pour le prochain élément
  }, delay);
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API routes
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/upload", uploadRouter);

// Socket.io
io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("disconnect", () => {
    console.log(`user disconnected: ${socket.id}`);
  });
});

// Start server
const SERVER_URL = process.env.SERVER_URL;
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on ${SERVER_URL}`);
});
