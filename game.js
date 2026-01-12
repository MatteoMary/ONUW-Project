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
    this.players = []; // { id, name, ws, ready, isHost }
    this.started = false;
  }

  handleJoin(ws, msg) {
    if (this.started) {
      ws.send(JSON.stringify({ type: "error", message: "Game already started" }));
      return;
    }

    const name = (msg.name || "").trim().slice(0, 16);
    if (!name) {
      ws.send(JSON.stringify({ type: "error", message: "Name is required" }));
      return;
    }

    if (this.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      ws.send(JSON.stringify({ type: "error", message: "Name already taken" }));
      return;
    }

    const player = {
      id: uid("p"),
      name,
      ws,
      ready: false,
      isHost: this.players.length === 0,
    };

    ws.playerId = player.id;
    this.players.push(player);

    ws.send(JSON.stringify({
      type: "joined_room",
      roomCode: this.roomCode,
      playerId: player.id,
      isHost: player.isHost,
    }));

    this.broadcastLobby();
  }

  handleMessage(ws, msg) {
    const player = this.players.find(p => p.ws === ws);
    if (!player) return;

    if (msg.type === "set_ready") {
      player.ready = !!msg.ready;
      this.broadcastLobby();
      return;
    }

    if (msg.type === "start_game") {
      if (!player.isHost) {
        ws.send(JSON.stringify({ type: "error", message: "Only host can start" }));
        return;
      }
      if (this.players.length < 3) {
        ws.send(JSON.stringify({ type: "error", message: "Need at least 3 players" }));
        return;
      }
      if (!this.players.every(p => p.ready)) {
        ws.send(JSON.stringify({ type: "error", message: "All players must be ready" }));
        return;
      }

      this.started = true;
      this.broadcast({ type: "game_started" });
      return;
    }

    ws.send(JSON.stringify({ type: "error", message: "Unsupported action" }));
  }

  handleDisconnect(ws) {
    const idx = this.players.findIndex(p => p.ws === ws);
    if (idx === -1) return;

    const wasHost = this.players[idx].isHost;
    this.players.splice(idx, 1);

    // Reassign host if needed
    if (wasHost && this.players.length > 0) {
      this.players[0].isHost = true;
    }

    this.broadcastLobby();
  }

  broadcastLobby() {
    const payload = {
      type: "lobby_state",
      roomCode: this.roomCode,
      started: this.started,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        isHost: p.isHost,
      })),
    };

    this.broadcast(payload);
  }

  broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const p of this.players) {
      if (p.ws && p.ws.readyState === 1) {
        p.ws.send(msg);
      }
    }
  }
}
