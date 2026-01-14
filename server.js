import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const server = createServer(app);
const io = new Server(server);

app.use(
  cors({
    origin: "http://localhost:8080",
  })
);
app.use(express.static(__dirname + "/dist/client"));

app.get("/", function (req, res) {
  res.sendFile(path.resolve(__dirname, "dist/client/index.html"));
});

io.sockets.on("connection", (socket) => {
  socket.userData = { x: 0, y: 0, z: 0, heading: 0 };

  console.log(`${socket.id} connected`);
  socket.emit("setId", { id: socket.id });

  socket.on("disconnect", () => {
    socket.broadcast.emit("deletedPlayer", { id: socket.id });
  });

  socket.on("init", (data) => {
    console.log(`init with model: ${data.model}`);
    socket.userData.model = data.model;
    socket.userData.color = data.color;
    socket.userData.x = data.x;
    socket.userData.y = data.y;
    socket.userData.z = data.z;
    socket.userData.heading = data.h;
    socket.userData.pb = data.pb;
    socket.userData.action = "Idle";
  });

  socket.on("update", (data) => {
    socket.userData.x = data.x;
    socket.userData.y = data.y;
    socket.userData.z = data.z;
    socket.userData.heading = data.h;
    socket.userData.pb = data.pb;
    socket.userData.action = data.action;
  });

  socket.on("chat message", function (data) {
    console.log(`chat id: ${data.id}, message: ${data.message}`);
    io.to(data.id).emit("chat message", {
      id: socket.id,
      message: data.message,
    });
  });
});

let port = process.env.PORT || 6500;

server.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

setInterval(async () => {
  let pack = [];

  const sockets = await io.fetchSockets();

  sockets.forEach((socket) => {
    if (socket.userData.model !== undefined) {
      pack.push({
        id: socket.id,
        model: socket.userData.model,
        color: socket.userData.color,
        x: socket.userData.x,
        y: socket.userData.y,
        z: socket.userData.z,
        heading: socket.userData.heading,
        pb: socket.userData.pb,
        action: socket.userData.action,
      });
    }
  });

  if (pack.length > 0) io.emit("remoteData", pack);
}, 40);
