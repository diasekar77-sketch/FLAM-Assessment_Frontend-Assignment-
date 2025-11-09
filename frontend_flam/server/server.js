import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.get("/", (req, res) => {
  res.send("Collaborative Canvas Server is running!");
});

let currentCanvas = []; // Store all lines (for new users)

io.on("connection", (socket) => {
  console.log(" New client connected:", socket.id);

  // Send existing canvas to new user
  socket.emit("loadCanvas", currentCanvas);

  socket.on("draw", (data) => {
    currentCanvas.push(data);
    socket.broadcast.emit("draw", data);
  });

  socket.on("clear", () => {
    currentCanvas = [];
    io.emit("clear");
  });

  socket.on("disconnect", () => {
    console.log(" Client disconnected:", socket.id);
  });
});

server.listen(4000, () => console.log(" Server running on port 4000"));
