import crypto from "crypto";

const rooms = new Map();

export const Roles = {
  WEREWOLF: "WEREWOLF",
  MINION: "MINION",
  SEER: "SEER",
  ROBBER: "ROBBER",
  TROUBLEMAKER: "TROUBLEMAKER",
  DRUNK: "DRUNK",
  INSOMNIAC: "INSOMNIAC",
  MASON: "MASON",
  VILLAGER: "VILLAGER",
};

const NIGHT_ORDER = [
  { phase: "NIGHT_WEREWOLF", role: Roles.WEREWOLF },
  { phase: "NIGHT_MINION", role: Roles.MINION },
  { phase: "NIGHT_MASON", role: Roles.MASON },
  { phase: "NIGHT_SEER", role: Roles.SEER },
  { phase: "NIGHT_ROBBER", role: Roles.ROBBER },
  { phase: "NIGHT_TROUBLEMAKER", role: Roles.TROUBLEMAKER },
  { phase: "NIGHT_DRUNK", role: Roles.DRUNK },
  { phase: "NIGHT_INSOMNIAC", role: Roles.INSOMNIAC },
];

function roomCode(len = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

    this.players = [];
    this.started = false;

    this.phase = "LOBBY";
    this.nightIndex = -1;

    this.selectedRoles = [];
    this.centerRoles = [];

    this.pending = null;
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
      originalRole: null,
      currentRole: null,
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
      if (this.started) return;
      player.ready = !!msg.ready;
      this.broadcastLobby();
      return;
    }

    if (msg.type === "start_game") {
      if (!player.isHost) return this.safeError(ws, "Only host can start");
      if (this.players.length < 3) return this.safeError(ws, "Need at least 3 players");
      if (!this.players.every(p => p.ready)) return this.safeError(ws, "All players must be ready");

      this.startGame();
      return;
    }

    if (msg.type === "submit_action") {
      this.handleSubmitAction(ws, msg);
      return;
    }

    this.safeError(ws, "Unsupported action (commit #8)");
  }

  handleDisconnect(ws) {
    const idx = this.players.findIndex(p => p.ws === ws);
    if (idx === -1) return;

    const leaving = this.players[idx];
    const wasHost = leaving.isHost;

    this.players.splice(idx, 1);

    if (!this.started) {
      if (wasHost && this.players.length > 0) this.players[0].isHost = true;
      this.broadcastLobby();
      return;
    }

    this.broadcastLobby();
  }


  buildDefaultRoles(playerCount) {
    const base = [
      Roles.WEREWOLF, Roles.WEREWOLF,
      Roles.MINION,
      Roles.SEER,
      Roles.ROBBER,
      Roles.TROUBLEMAKER,
      Roles.DRUNK,
      Roles.INSOMNIAC,
    ];
    const need = playerCount + 3;
    const roles = base.slice(0, need);
    while (roles.length < need) roles.push(Roles.VILLAGER);
    return roles;
  }

  startGame() {
    this.started = true;
    this.phase = "SETUP";
    this.nightIndex = -1;
    this.pending = null;

    const deckSize = this.players.length + 3;
    this.selectedRoles = this.buildDefaultRoles(this.players.length);

    if (this.selectedRoles.length !== deckSize) {
      throw new Error("Role deck size mismatch");
    }

    const deck = shuffle(this.selectedRoles);

    for (let i = 0; i < this.players.length; i++) {
      const r = deck[i];
      this.players[i].originalRole = r;
      this.players[i].currentRole = r;
    }

    this.centerRoles = deck.slice(this.players.length);

    this.broadcast({ type: "game_started", phase: this.phase });
    this.sendAllPrivateStates();
    this.broadcastLobby();

    this.advancePhase(); 
  }


  roleInPlay(role) {
    return this.selectedRoles.includes(role);
  }

  requiredActorsForRole(role) {
    return this.players
      .filter(p => p.originalRole === role)
      .map(p => p.id);
  }

  advancePhase() {
    if (this.phase === "SETUP") {
      this.nightIndex = -1;
      this.advanceNight();
      return;
    }

    if (this.phase.startsWith("NIGHT_")) {
      this.advanceNight();
      return;
    }

    if (this.phase === "DISCUSSION") {
      this.setPhase("VOTING");
      return;
    }

  }

  advanceNight() {
    while (true) {
      this.nightIndex += 1;
      const next = NIGHT_ORDER[this.nightIndex];

      if (!next) {
        this.setPhase("DISCUSSION");
        return;
      }

      if (!this.roleInPlay(next.role)) continue;

      this.setPhase(next.phase);

      this.beginNightPhase(next.role);
      return;
    }
  }

  setPhase(phase) {
    this.phase = phase;
    this.broadcast({ type: "phase_changed", phase: this.phase });
    this.broadcastLobby();
  }

  beginNightPhase(role) {
    const actors = this.requiredActorsForRole(role);

    if (actors.length === 0) {
      this.advancePhase();
      return;
    }

    const confirmOnlyRoles = new Set([Roles.WEREWOLF, Roles.MINION, Roles.MASON, Roles.INSOMNIAC]);
    if (!confirmOnlyRoles.has(role)) {
      this.advancePhase();
      return;
    }

    const actionId = uid("a");
    this.pending = {
      actionId,
      phase: this.phase,
      role,
      requiredActors: actors,
      completedActors: new Set(),
      schemaType: "confirm_only",
    };

    for (const pid of actors) {
      const p = this.players.find(x => x.id === pid);
      this.safeSend(p, {
        type: "prompt_action",
        actionId,
        phase: this.phase,
        prompt: {
          title: role,
          text: this.promptTextForRole(role, actors.length),
          schema: { type: "confirm_only" },
        },
      });
    }

    for (const p of this.players) {
      if (!actors.includes(p.id)) {
        this.safeSend(p, { type: "phase_wait", phase: this.phase });
      }
    }
  }

  promptTextForRole(role, actorCount) {
    if (role === Roles.WEREWOLF) {
      if (actorCount >= 2) return "Werewolves: open your eyes and see each other. Tap Confirm when done.";
      return "You are the only Werewolf. (Center peek comes later.) Tap Confirm.";
    }
    if (role === Roles.MINION) return "Minion: see the Werewolves. Tap Confirm when done.";
    if (role === Roles.MASON) return "Mason: see the other Mason (if any). Tap Confirm.";
    if (role === Roles.INSOMNIAC) return "Insomniac: you may check your final role later (implemented soon). Tap Confirm.";
    return "Tap Confirm.";
  }


  handleSubmitAction(ws, msg) {
    const actorId = ws.playerId;
    if (!actorId) return this.safeError(ws, "Not joined");

    if (!this.pending) return this.safeError(ws, "No action pending");
    if (msg.actionId !== this.pending.actionId) return this.safeError(ws, "Stale action");

    if (this.pending.phase !== this.phase) return this.safeError(ws, "Wrong phase");
    if (!this.pending.requiredActors.includes(actorId)) return this.safeError(ws, "You are not required to act");
    if (this.pending.completedActors.has(actorId)) return this.safeError(ws, "Already submitted");

    const type = msg.type || msg.actionType || msg.action;
    const actionType = msg.actionType || msg.subtype || msg.kind || msg.payloadType || msg.clientType || msg.typeOverride;
    const actualType = msg.action || msg.actionType || msg.kind || msg.payload?.type || msg.confirmType;

    const ok = (msg.action === "confirm_only") || (msg.actionType === "confirm_only") || (msg.payload?.type === "confirm_only");
    if (!ok) return this.safeError(ws, "Invalid action for this phase");

    this.pending.completedActors.add(actorId);

    ws.send(JSON.stringify({ type: "action_ack", actionId: this.pending.actionId }));

    const allDone = this.pending.requiredActors.every(pid => this.pending.completedActors.has(pid));
    if (allDone) {
      this.pending = null;
      this.advancePhase();
    }
  }


  sendAllPrivateStates() {
    for (const p of this.players) {
      this.safeSend(p, {
        type: "private_state",
        phase: this.phase,
        playerId: p.id,
        originalRole: p.originalRole,
        currentRole: p.currentRole,
      });
    }
  }


  broadcastLobby() {
    const payload = {
      type: "lobby_state",
      roomCode: this.roomCode,
      started: this.started,
      phase: this.phase,
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
      if (p.ws && p.ws.readyState === 1) p.ws.send(msg);
    }
  }

  safeSend(player, obj) {
    if (player?.ws && player.ws.readyState === 1) {
      player.ws.send(JSON.stringify(obj));
    }
  }

  safeError(ws, message) {
    ws.send(JSON.stringify({ type: "error", message }));
  }
}
