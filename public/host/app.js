const socketUrl = "ws://localhost:3000/creategame";
let socket = null;

document.getElementById("host-game-btn").addEventListener("click", () => {
    try {
        socket = new WebSocket(socketUrl);

        socket.addEventListener("open", () => {
            console.log("Connected to socket");
        });

        socket.addEventListener("close", () => {
            console.log("Closed socket connection");
        });

        socket.addEventListener("error", (err) => {
            console.log(`An error occured in the WebSocket: ${err}`);
        });

        socket.addEventListener("message", (event) => {
            console.log(event.data);
        });
    }
    catch (err) {
        console.log(`Unable to host a game: ${err}`);
    }
});