const lobbySection = document.getElementById("lobby");
const gameSection = document.getElementById("game");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");

const playerList = document.getElementById("playerList");
const roleInfo = document.getElementById("roleInfo");

const state = {
  players: [],
  phase: "Lobby",
};

createRoomBtn.addEventListener("click", () => {
  console.log("Create Room clicked");
});

joinRoomBtn.addEventListener("click", () => {
  console.log("Join Room clicked");
});

function render() {
  playerList.innerHTML = "";
  state.players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    playerList.appendChild(li);
  });

  roleInfo.textContent = "Role will be revealed when the game starts.";
}

render();
