const pageUrl = new URL(window.location);
const domain = pageUrl.hostname; 
const port = pageUrl.port || (pageUrl.protocol === "https:" ? "443" : "80");
const socketUrl = `ws://${domain}:${port}/wsconnect`;
let socket = null;
let players = [];
let timerInterval = null;
let startTime = null;
let timerEl = null;
let round = null;
const maxTime = 1000 * 60 * 2;

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
        else if (message.type === 'start-game') {
            switchSection("start-section");
        }
        else if (message.type === 'drawing-stage') {
            round = message.round;
            drawStage(message.prompt);
            timerEl = document.getElementById("draw-timer");
            setTimer(message.startTime);
        }
        else if (message.type === 'guessing-stage') {
            round = message.round;
            guessStage(message.drawing);
            timerEl = document.getElementById("guess-timer");
            setTimer(message.startTime);
        }
    });

    socket.addEventListener("close", () => {
        console.log("WebSocket closed");
    });
}
catch (err) {
    console.log(`Error connecting to websocket: ${err}`);
}

startSubmitBtn.addEventListener('click', function () {
    const phrase = startSubmitBtn.value.trim();
    console.log(phrase);
    startSubmitBtn.disabled = true;
    startPromptInput.disabled = true;
    startSubmitBtn.innerHTML = "Submited";
    socket.send(JSON.stringify({ type: "set-prompt", prompt: startPromptInput.value }));
});

document.getElementById("drawing-submit").addEventListener("click", function () {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "set-drawing", round, drawing: { actions: actionHistory } }));
        this.disabled = true;
    }
});

document.getElementById("guess-btn").addEventListener("click", function () {
    const guess = document.getElementById("guess-input").value.trim();
    if (guess && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "set-guess", round, guess}));
        this.disabled = true;
    }
});

function switchSection(sectionId) {
    const sections = document.getElementsByTagName("section");
    //sections.forEach(section => section.classList.add("hidden"));
    for (let i = 0; i < sections.length; i++) {
        sections[i].classList.add("hidden");
    }
    document.getElementById(sectionId).classList.remove("hidden");
}

function drawStage(prompt) {
    painting = false;
    actions = [];
    viewActionIndex = -1;
    contextMenu = false;

    clearCanvas();
    document.getElementById("draw-prompt").value = prompt;
    document.getElementById("drawing-submit").disabled = false;

    switchSection("drawing-section");
}

function guessStage(drawing) {
    const guessCanvas = document.getElementById('guess-canvas');
    const guessCtx = guessCanvas.getContext('2d');

    drawing.actions.forEach(action => {
        let drawAction = null;
        switch (action.type) {
            case 'brush-path':
                drawAction = new BrushPath(action.color, action.thickness);
                drawAction.points = action.points;
                break;
            case 'eraser-path':
                drawAction = new EraserPath(action.thickness);
                drawAction.points = action.points;
                break;
            case 'clear-path':
                drawAction = new ClearPath();
                break;
            case 'bucket-path':
                drawAction = new BucketPath(action.x, action.y, action.targetColor, action.fillColor);
                break;
            case 'polygon-path':
                drawAction = new PolygonPath(action.color, action.thickness);
                drawAction.points = action.points;
                break;
        }
        if (drawAction) {
            drawAction.draw(guessCtx)
        }
    });

    document.getElementById("guess-input").value = "";
    document.getElementById("guess-btn").disabled = false;

    switchSection("guess-section");
}

function setTimer(start) {
    startTime = start;

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
        const endTime = startTime + maxTime;
        const currentTime = new Date().getTime();

        const seconds = Math.floor(Math.max(endTime - currentTime, 0) / 1000);
        if (timerEl) {
            timerEl.innerText = `${ Math.floor(seconds / 60) }:${ seconds % 60 }`;
        }
        else console.log("no timer");


        if (currentTime > endTime) {
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        }

    }, 1000);
}