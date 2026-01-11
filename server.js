import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

import { createRoom, getRoom } from "./game.js";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    if (msg.type === "create_room") {
      const room = createRoom();
      ws.roomCode = room.roomCode;
      ws.send(JSON.stringify({ type: "room_created", roomCode: room.roomCode }));
      return;
    }

    if (msg.type === "join_room") {
      const code = (msg.roomCode || "").trim().toUpperCase();
      const room = getRoom(code);
      if (!room) {
        ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
        return;
      }
      ws.roomCode = code;
      room.handleJoin(ws, msg);
      return;
    }

    const code = ws.roomCode;
    if (!code) {
      ws.send(JSON.stringify({ type: "error", message: "Not in a room" }));
      return;
    }

    const room = getRoom(code);
    if (!room) {
      ws.send(JSON.stringify({ type: "error", message: "Room expired / not found" }));
      return;
    }

    room.handleMessage(ws, msg);
  });

  ws.on("close", () => {
    const code = ws.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    room.handleDisconnect(ws);
  });
});

server.listen(PORT, () => {
  console.log(`ONUW server running at http://localhost:${PORT}`);
});
