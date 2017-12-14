const express = require("express");
const app = express();
app.use(express.static("html"));
app.use(express.static("css"));
app.use(express.static("js"));
app.listen(3000, () => console.log("Example app listening on port 3000!"));
