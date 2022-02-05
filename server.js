const express = require("express");
const path = require("path");
const socketio = require("socket.io");
const app = express();
const http = require("http");
const cors = require("cors");

const server = http.createServer(app);
const io = socketio(server);

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
