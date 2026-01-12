const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const startGameBtn = document.getElementById("startGameBtn");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const readyCheckbox = document.getElementById("readyCheckbox");

const playerList = document.getElementById("playerList");
const hostControls = document.getElementById("hostControls");

let state = {
  roomCode: null,
  playerId: null,
  isHost: false,
  players: [],
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
    state.isHost = msg.players.some(p => p.id === state.playerId && p.isHost);
    render();
  }

  if (msg.type === "game_started") {
    alert("Game starting!");
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

readyCheckbox.onchange = () => {
  send("set_ready", { ready: readyCheckbox.checked });
};

startGameBtn.onclick = () => {
  send("start_game");
};

function render() {
  playerList.innerHTML = "";
  for (const p of state.players) {
    const li = document.createElement("li");
    li.textContent = `${p.name}${p.isHost ? " (Host)" : ""} ${p.ready ? "✅" : "❌"}`;
    playerList.appendChild(li);
  }

  hostControls.classList.toggle("hidden", !state.isHost);
}
