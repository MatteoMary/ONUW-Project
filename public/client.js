const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const startGameBtn = document.getElementById("startGameBtn");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const readyCheckbox = document.getElementById("readyCheckbox");

const playerList = document.getElementById("playerList");
const hostControls = document.getElementById("hostControls");

const lobbySection = document.getElementById("lobby");
const gameSection = document.getElementById("game");

const roleInfo = document.getElementById("roleInfo");
const phaseLabel = document.getElementById("phaseLabel");
const phaseHint = document.getElementById("phaseHint");

const actionArea = document.getElementById("actionArea");
const actionContent = document.getElementById("actionContent");

let state = {
  roomCode: null,
  playerId: null,
  isHost: false,
  players: [],
  started: false,
  phase: "LOBBY",

  originalRole: null,
  currentRole: null,

  pendingActionId: null,
};

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);

  if (msg.type === "room_created") {
    roomInput.value = msg.roomCode;
    alert(`Room created: ${msg.roomCode}`);
  }

  if (msg.type === "joined_room") {
    state.roomCode = msg.roomCode;
    state.playerId = msg.playerId;
    state.isHost = msg.isHost;
    render();
  }

  if (msg.type === "lobby_state") {
    state.players = msg.players;
    state.started = !!msg.started;
    state.phase = msg.phase || state.phase;
    state.isHost = msg.players.some(p => p.id === state.playerId && p.isHost);
    render();
  }

  if (msg.type === "game_started") {
    state.started = true;
    state.phase = msg.phase || "SETUP";
    render();
  }

  if (msg.type === "phase_changed") {
    state.phase = msg.phase;
    clearActionUI();
    render();
  }

  if (msg.type === "phase_wait") {
    clearActionUI();
    render();
  }

  if (msg.type === "private_state") {
    state.phase = msg.phase || state.phase;
    state.originalRole = msg.originalRole;
    state.currentRole = msg.currentRole;
    render();
  }

  if (msg.type === "prompt_action") {
    state.pendingActionId = msg.actionId;
    showActionPrompt(msg);
    render();
  }

  if (msg.type === "action_result") {
    actionArea.classList.remove("hidden");
    actionContent.innerHTML = `
      <div><b>${msg.title || "Result"}</b></div>
      <div style="margin-top:8px;">${msg.text || ""}</div>
    `;
  }

  if (msg.type === "action_ack") {
    setTimeout(() => {
      if (!actionContent.innerHTML.trim()) clearActionUI();
    }, 50);
    render();
  }

  if (msg.type === "error") {
    alert(msg.message);
  }
});

function send(type, payload = {}) {
  ws.send(JSON.stringify({ type, ...payload }));
}

createRoomBtn.onclick = () => send("create_room");

joinRoomBtn.onclick = () => {
  const name = nameInput.value.trim();
  const roomCode = roomInput.value.trim().toUpperCase();
  if (!name || !roomCode) return alert("Enter name and room code");
  send("join_room", { name, roomCode });
};

readyCheckbox.onchange = () => send("set_ready", { ready: readyCheckbox.checked });

startGameBtn.onclick = () => send("start_game");

function phaseMessage(phase) {
  if (phase === "SETUP") return "Dealing roles…";
  if (phase.startsWith("NIGHT_")) return "Night phase: act if prompted.";
  if (phase === "DISCUSSION") return "Discuss with the group!";
  if (phase === "VOTING") return "Voting will be implemented soon.";
  return "Waiting…";
}

function render() {
  playerList.innerHTML = "";
  for (const p of state.players) {
    const li = document.createElement("li");
    li.textContent = `${p.name}${p.isHost ? " (Host)" : ""} ${p.ready ? "✅" : "❌"}`;
    playerList.appendChild(li);
  }

  hostControls.classList.toggle("hidden", !state.isHost || state.started);

  gameSection.classList.toggle("hidden", !state.started);
  lobbySection.classList.toggle("hidden", state.started);

  if (phaseLabel) phaseLabel.textContent = `Phase: ${state.phase}`;
  if (phaseHint) phaseHint.textContent = phaseMessage(state.phase);

  if (state.originalRole) {
    roleInfo.innerHTML = `
      <div><b>Original:</b> ${state.originalRole}</div>
      <div><b>Current:</b> ${state.currentRole}</div>
    `;
  } else {
    roleInfo.textContent = "Waiting for role…";
  }
}

function showActionPrompt(msg) {
  const { actionId, prompt } = msg;

  actionArea.classList.remove("hidden");
  actionContent.innerHTML = `
    <div><b>${prompt.title}</b></div>
    <div style="margin: 8px 0;">${prompt.text}</div>
  `;

  if (prompt?.schema?.type === "confirm_only") {
    const btn = document.createElement("button");
    btn.textContent = "Confirm";
    btn.onclick = () => {
      send("submit_action", {
        actionId,
        actionType: "confirm_only",
        payload: { type: "confirm_only" },
      });
    };
    actionContent.appendChild(btn);
    return;
  }

  if (prompt?.schema?.type === "seer") {
    const schema = prompt.schema;

    const viewPlayerBtn = document.createElement("button");
    viewPlayerBtn.textContent = "View 1 Player";
    viewPlayerBtn.onclick = () => renderSeerPlayerMode(actionId, schema.players);

    const viewCenterBtn = document.createElement("button");
    viewCenterBtn.textContent = "View 2 Center Cards";
    viewCenterBtn.onclick = () => renderSeerCenterMode(actionId);

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.flexWrap = "wrap";
    row.appendChild(viewPlayerBtn);
    row.appendChild(viewCenterBtn);

    actionContent.appendChild(row);
    return;
  }

  const p = document.createElement("div");
  p.textContent = "Action type not implemented yet.";
  actionContent.appendChild(p);
}

function renderSeerPlayerMode(actionId, players) {
  actionContent.innerHTML += `<div style="margin-top:10px;"><b>Choose a player:</b></div>`;

  const select = document.createElement("select");
  select.style.padding = "10px";
  select.style.borderRadius = "10px";
  select.style.marginTop = "6px";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Select --";
  select.appendChild(placeholder);

  for (const p of players) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  }

  const submit = document.createElement("button");
  submit.textContent = "Reveal";
  submit.style.marginLeft = "10px";
  submit.onclick = () => {
    const targetPlayerId = select.value;
    if (!targetPlayerId) return alert("Pick a player");
    send("submit_action", {
      actionId,
      actionType: "seer",
      payload: { type: "seer", mode: "player", targetPlayerId },
    });
  };

  actionContent.appendChild(select);
  actionContent.appendChild(submit);
}

function renderSeerCenterMode(actionId) {
  actionContent.innerHTML += `<div style="margin-top:10px;"><b>Pick 2 center cards:</b></div>`;

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "10px";
  wrap.style.flexWrap = "wrap";
  wrap.style.marginTop = "6px";

  const checks = [0, 1, 2].map((i) => {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = String(i);

    label.appendChild(cb);
    label.appendChild(document.createTextNode(`Center ${i + 1}`));
    wrap.appendChild(label);

    return cb;
  });

  const submit = document.createElement("button");
  submit.textContent = "Reveal";
  submit.onclick = () => {
    const picked = checks.filter(c => c.checked).map(c => Number(c.value));
    if (picked.length !== 2) return alert("Pick exactly 2 center cards");
    send("submit_action", {
      actionId,
      actionType: "seer",
      payload: { type: "seer", mode: "center", indices: picked },
    });
  };

  actionContent.appendChild(wrap);
  actionContent.appendChild(submit);
}

function clearActionUI() {
  state.pendingActionId = null;
  actionArea.classList.add("hidden");
  actionContent.innerHTML = "";
}
