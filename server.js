const express = require("express");
const port = 6500;
const path = require("path");
const app = express();
const httpServer = require("http").createServer(app);

app.use(express.static(__dirname + "/dist/client"));

app.get("/", function (req, res) {
  res.sendFile(path.resolve(__dirname, "dist/client/index.html"));
});

console.log("hello");

httpServer.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
