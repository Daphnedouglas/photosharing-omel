require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const photoRoutes = require("./routes/photos");
const postRoutes = require("./routes/posts");
const friendRoutes = require("./routes/friends");
const shareRoutes = require("./routes/share");
const albumRoutes = require("./routes/albums");
const stripRoutes = require("./routes/strips");
const activityRoutes = require("./routes/activity");
const searchRoutes = require("./routes/search");

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.set("trust proxy", 1);

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.type("text/plain").send("ok");
});

app.use("/api/auth", authRoutes);
app.use("/api/photos", photoRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/strips", stripRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/search", searchRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error." });
});

const server = http.createServer(app);

server.on("error", (err) => {
  console.error("Failed to start server:", err.message);
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other node process and try again.`);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  const addr = server.address();
  if (!addr) {
    console.error("Listen callback ran but the server is not bound. Exiting.");
    process.exit(1);
    return;
  }
  console.log(`Omel API listening on http://localhost:${PORT}`);
});
