import crypto from "crypto";

const rooms = new Map();

function roomCode(len = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export function createRoom() {
  let code = roomCode();
  while (rooms.has(code)) code = roomCode();

  const room = new Room(code);
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get(code);
}

class Room {
  constructor(code) {
    this.roomCode = code;
    this.players = []; // { id, name, ws }
  }

  handleJoin(ws, msg) {
    const nameRaw = (msg.name || "").trim();
    const name = nameRaw.slice(0, 16);

    if (!name) {
      ws.send(JSON.stringify({ type: "error", message: "Name is required" }));
      return;
    }

    // prevent duplicate names (simple)
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      ws.send(JSON.stringify({ type: "error", message: "Name already taken" }));
      return;
    }

    const player = {
      id: uid("p"),
      name,
      ws,
    };

    ws.playerId = player.id;
    this.players.push(player);

    ws.send(JSON.stringify({
      type: "joined_room",
      roomCode: this.roomCode,
      playerId: player.id,
      isHost: this.players.length === 1,
    }));

    this.broadcastLobby();
  }

  handleMessage(ws, msg) {
    // Commit #4: only lobby broadcasting exists.
    // Future commits will add ready/roles/actions.
    if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
      return;
    }

    ws.send(JSON.stringify({ type: "error", message: "Unsupported message (commit #4)" }));
  }

  handleDisconnect(ws) {
    const idx = this.players.findIndex((p) => p.ws === ws);
    if (idx !== -1) {
      this.players.splice(idx, 1);
      this.broadcastLobby();
    }
  }

  broadcastLobby() {
    const payload = {
      type: "lobby_state",
      roomCode: this.roomCode,
      players: this.players.map((p) => ({ id: p.id, name: p.name })),
    };

    const msg = JSON.stringify(payload);
    for (const p of this.players) {
      if (p.ws && p.ws.readyState === 1) {
        p.ws.send(msg);
      }
    }
  }
}
