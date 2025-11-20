const socketUrl = "ws://localhost:5600";
let socket = null;

try {
    socket = new WebSocket(socketUrl);

    socket.addEventListener("open", () => {
        console.log("Connected to WebSocket");
    });

    socket.addEventListener("error", (err) => {
        console.log(`WebSocket error: ${err}`);
    });

    socket.addEventListener("message", (event) => {
        console.log(event.data);
    });

    socket.addEventListener("close", () => {
        console.log("WebSocket closed");
    });
}
catch (err) {
    console.log(`Error connecting to websocket: ${err}`);
}