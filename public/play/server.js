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
                if (players.length === 2) {
                    document.getElementById("begin-game-btn").disabled = false;
                }
            }
        }
        else if (message.type === 'player-disconnected') {
            players = players.filter(p => p.username !== message.player.username);
            if (players.length < 2) {
                document.getElementById("begin-game-btn").disabled = true;
            }
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
        else if (message.type === 'results-stage' && message.players) {
            console.log("Game over!");
            endGame(message.players);
        }
    });

    socket.addEventListener("close", () => {
        console.log("WebSocket closed");
        if (document.getElementById("results-section").classList.contains("hidden")) {
            alert("Connection to server lost.");
            window.location.href = "/";
        }
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

const endGameButtons = document.querySelectorAll(".end-game-btn");
endGameButtons.forEach(button => {
    button.addEventListener("click", () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "end-game" }));
        }
    })
})

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
    actionHistory = [];
    viewActionIndex = -1;
    contextMenu = false;

    clearCanvas();
    document.getElementById("draw-prompt").innerText = prompt;
    document.getElementById("drawing-submit").disabled = false;

    switchSection("drawing-section");
}

function guessStage(drawing) {
    const guessCanvas = document.getElementById('guess-canvas');
    const guessCtx = guessCanvas.getContext('2d');

    drawToContext(drawing.actions, guessCtx);

    document.getElementById("guess-input").value = "";
    document.getElementById("guess-btn").disabled = false;

    switchSection("guess-section");
}

function drawToContext(drawActions, context) {
    actions = [];
    actionHistory = [];
    viewActionIndex = -1;
    clearCanvas(context);

    drawActions.forEach(action => {
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
            case 'undo':
                undo();
                break;
            case 'redo':
                redo();
                break;
        }
        if (drawAction) {
            appendAction(drawAction);
        }
    });
    paintCanvas(context);
}

function setTimer(start) {
    return;
    startTime = start;

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
        const endTime = startTime + maxTime;
        const currentTime = new Date().getTime();

        const seconds = Math.floor(Math.max(endTime - currentTime, 0) / 1000);
        if (timerEl) {
            timerEl.innerText = `${ Math.floor(seconds / 60) }:${ String(seconds % 60).padStart(2, '0') }`;
        }
        else console.log("no timer");


        if (currentTime > endTime) {
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        }

    }, 1000);
}

function endGame(players) {
    const resultsSection = document.querySelector("#results-section .center-column");
    const roundMax = players.length;
    players.forEach((player, i) => {
        resultsSection.appendChild(document.createElement('br'));
        resultsSection.appendChild(createElementFromHTML(`<h2 style="color: lightskyblue;">${player.username}</h2>`));
        // append prompt
        resultsSection.appendChild(createElementFromHTML(`<div class="prompt-box">${player.startingPrompt}</div>`));

        // go through rounds
        let drawingStage = false; 
        for (let r = 1; r < roundMax; r++) {
            drawingStage = !drawingStage;
            const playerIndex = (i + r) % players.length;
            const player = players[playerIndex];
            if (drawingStage) {
                const drawing = player.drawings[(r - 1) / 2];
                const canvas = createElementFromHTML(`<canvas height='500' width='800'></canvas>`);
                const ctx = canvas.getContext('2d');
                if (drawing && drawing.actions) {
                    drawToContext(drawing.actions, ctx);
                }
                resultsSection.appendChild(createElementFromHTML(`<h4>Drew by ${player.username}</h4>`));
                resultsSection.appendChild(canvas);
            }
            else {
                const guess = player.guesses[r / 2 - 1];
                resultsSection.appendChild(createElementFromHTML(`<div class="prompt-box">${player.username}: ${guess || ""}</div>`));
            }
        }
    });

    switchSection("results-section");
}

const createElementFromHTML = (html) => {
    const el = document.createElement('div');
    el.innerHTML = html;

    return el.firstChild;
}