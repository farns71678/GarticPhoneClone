const socketUrl = "ws://localhost:3000/wsconnect";
let socket = null;
let players = [];

const playerListRequest = {
    type: 'player-list-request'
};
const playerListRequestMsg = JSON.stringify(playerListRequest);

try {
    socket = new WebSocket(socketUrl);

    socket.addEventListener("open", () => {
        console.log("Connected to WebSocket");
        socket.send(playerListRequestMsg);
    });

    socket.addEventListener("error", (err) => {
        console.log(`WebSocket error: ${err}`);
    });

    socket.addEventListener("message", (event) => {
        console.log(event.data);
        const message = JSON.parse(event.data);
        const playerList = document.getElementById("players-ul");

        if (message.type === 'player-list') {
            playerList.innerHTML = "";
            message.players.forEach(player => {
                const li = document.createElement("li");
                li.innerText = player.username;
                playerList.appendChild(li);
            });
            players = message.players;
            return;
        }
        else if (message.type === 'player-connected') {
            if (!players.find(p => p.username === message.player.username)) {
                const li = document.createElement("li");
                li.innerText = message.player.username;
                playerList.appendChild(li);
                players.push(message.player);
            }
        }
        else if (message.type === 'player-disconnected') {
            players = players.filter(p => p.username !== message.player.username);
            const items = playerList.getElementsByTagName("li");
            for (let i = 0; i < items.length; i++) {
                if (items[i].innerText === message.player.username) {
                    playerList.removeChild(items[i]);
                    break;
                }
            }
        }
    });

    socket.addEventListener("close", () => {
        console.log("WebSocket closed");
    });
}
catch (err) {
    console.log(`Error connecting to websocket: ${err}`);
}