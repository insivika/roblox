const express = require("express");
const app = express();
const port = 6500;
const path = require("path");

app.use(express.static(__dirname + "/dist/client"));

app.get("/", function (req, res) {
  res.sendFile(path.resolve(__dirname, "dist/client/index.html"));
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
