const express = require("express");
const app = express();

app.get("/", (req, res) => {
  console.log("API HIT");
  res.send("Backend working 🚀");
});

app.listen(5001, () => {
  console.log("Server running on port 5001");
});