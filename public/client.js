const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");

const playerList = document.getElementById("playerList");

let state = {
  roomCode: null,
  playerId: null,
  isHost: false,
  players: [],
};

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

ws.addEventListener("open", () => {
  console.log("WebSocket connected");
});

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);

  if (msg.type === "room_created") {
    state.roomCode = msg.roomCode;
    roomInput.value = msg.roomCode;
    alert(`Room created: ${msg.roomCode}\nShare this code with players.`);
  }

  if (msg.type === "joined_room") {
    state.roomCode = msg.roomCode;
    state.playerId = msg.playerId;
    state.isHost = msg.isHost;
    console.log("Joined room:", state);
  }

  if (msg.type === "lobby_state") {
    state.roomCode = msg.roomCode;
    state.players = msg.players;
    renderLobby();
  }

  if (msg.type === "error") {
    alert(msg.message);
  }
});

function send(type, payload = {}) {
  ws.send(JSON.stringify({ type, ...payload }));
}

createRoomBtn.addEventListener("click", () => {
  send("create_room");
});

joinRoomBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  const roomCode = roomInput.value.trim().toUpperCase();

  if (!name) return alert("Enter your name");
  if (!roomCode) return alert("Enter a room code");

  send("join_room", { roomCode, name });
});

function renderLobby() {
  playerList.innerHTML = "";
  for (const p of state.players) {
    const li = document.createElement("li");
    li.textContent = p.name;
    playerList.appendChild(li);
  }
}
