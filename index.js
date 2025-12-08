const uuidv4 = require('uuid').v4;
const jwt = require('jsonwebtoken');
const express = require('express');
const ejs = require('ejs');
const Player = require("./models/Player");
const GameRoom = require("./models/GameRoom");
const WebSocket = require('ws');
const http = require('http');
const cookieParser = require("cookie-parser");
const cookie = require('cookie');
const { checkUser } = require('./middleware/authmiddleware');
const app = express();

let gameRooms = [];

const maxAge = 24 * 60 * 60;
const createToken = (id, gameId) => {
  return jwt.sign(
    { id, gameId },
    process.env.JWT_SECRET,
    {
      expiresIn: maxAge,
    }
  );
};

function generateJoinCode() {
    let code = '';
    while (code == '' || gameRooms.find(room => room.joinCode === code)) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    }
    return code;
}

function createGameRoom(host) {
    const id = uuidv4();
    const joinCode = generateJoinCode();
    const newRoom = new GameRoom(id, joinCode, host);
    gameRooms.push(newRoom);
    return newRoom;
}

app.use(cookieParser());
app.use(express.static(__dirname + "/public"));
app.set('view engine', 'ejs');

app.get('/hostgame', checkUser, (req, res) => {
    res.clearCookie('jwt'); // TODO: remove the comments and this line
    /*
    if (res.locals.player) {
        res.status(400).json({ error: "Already in a game room" });
        return;
    }*/

    const username = req.query.username;
    if (!username || username.trim() === '') {
        res.status(400).json({ error: "Username is required" });
        return;
    }
    try {
        const host = new Player(uuidv4(), username);
        const room = createGameRoom(host);
        res.cookie('jwt', createToken(host.id, room.id), { httpOnly: true, maxAge: maxAge * 1000});
        res.redirect(`http://localhost:3000/play?playerID=${host.id}&username=${host.username}`);
        //res.json({ roomId: room.id, joinCode: room.joinCode, playerID: host.id, username: host.username });
    }
    catch (error) {
        console.log(`Error creating game room: ${error}`);
        res.status(500).json({ error: "Failed to create game room" });
    }
});

app.get('/joingame', checkUser, (req, res) => {
    const query = req.query;
    if (!query.joinCode || !query.username) {
        res.status(400).json({ error: "Join code and username are required" });
        return;
    }

    const room = gameRooms.find(r => r.joinCode === query.joinCode);
    if (!room) {
        res.status(404).json({ error: "Game room not found" });
        return;
    }

    if (room.players.find(p => p.username === query.username)) {
        res.status(400).json({ error: "Username already taken in this game room" });
        return;
    }

    try {
        const player = new Player(uuidv4(), query.username);
        room.addPlayer(player);

        res.cookie('jwt', createToken(player.id, room.id), { httpOnly: true, maxAge: maxAge * 1000});
        res.redirect(`/play?playerID=${player.id}&username=${player.username}`);
    }
    catch (error) {
        console.log(`Error joining game: ${error}`);
        res.status(500).json({ error: "Failed to join game room" });
    }
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/join/index.html');
});

app.get('/play', checkUser, (req, res) => {
    if (!(res.locals.player && res.locals.room)) {
        res.redirect('/join');
        return;
    }

    const room = gameRooms.find(r => r.id == res.locals.room);
    if (!room) {
        res.clearCookie('jwt');
        res.redirect('/join');
        return;
    }
    const player = room.players.find(p => p.id == res.locals.player);
    if (!player) {
        res.clearCookie('jwt');
        res.redirect('/join');
        return;
    }

    res.render('play', {
        playerID: player.id,
        username: player.username,
        joinCode: room.joinCode,
        gameID: room.id,
        isHost: room.host.id === player.id
    });
});

// websocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server: server, path: "/wsconnect"})

wss.on('connection', (ws, req, client) => {
    //console.log('New WebSocket connection established');

    // authenticate client using jwt
    try {
        const token = cookie.parse(req.headers.cookie || '').jwt;
        if (!token) {
            ws.close(1008, "Unauthorized");
            return;
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                ws.close(1008, "Unauthorized");
                return;
            }
            const playerId = decoded.id;
            const gameId = decoded.gameId;
            const room = gameRooms.find(r => r.id === gameId);
            if (!room) {
                ws.close(1008, "Unauthorized");
                return;
            }
            const player = room.players.find(p => p.id === playerId);
            if (!player) {
                ws.close(1008, "Unauthorized");
                return;
            }

            // make sure game is in lobby stage
            if (room.stage !== 'lobby') {
                ws.close(1008, "Game already started");
                return;
            }

            player.socket = ws;
            console.log(`WebSocket authenticated for player ${player.username} in game ${room.joinCode}`);

            // initialize ws events
            ws.on('message', (msg) => {
                // TODO: handle incoming messages from player
                try {
                    const message = JSON.parse(msg);
                    if (message.type === 'player-list-request') {
                        const playerList = room.players.filter(p => p.socket != null).map(p => ({ username: p.username }));
                        ws.send(JSON.stringify({ type: 'player-list', players: playerList }));
                    }
                    else if (message.type === 'start-game' && room.host.id === player.id && room.stage === 'lobby') {
                        room.stage = 'prompt';
                        room.broadcastMessage({ type: 'start-game' });
                    }
                    else if (message.type === 'set-prompt' && room.stage === 'prompt' && !player.startingPrompt) {
                        player.startingPrompt = message.prompt;
                        // check if all players have set their prompts
                        if (room.players.every(p => p.startingPrompt)) {
                            // start gameplay
                            room.startGame();
                        }
                    }
                    else if (message.type === 'set-guess' && room.stage === 'guessing' && message.round == room.round) {
                        player.guesses[room.round / 2] = message.guess;
                        room.checkAdvance();
                    }
                    else if (message.type === 'set-drawing' && room.stage === 'drawing' && message.round == room.round) {
                        player.drawings[(room.round - 1) / 2] = message.drawing;
                        room.checkAdvance();
                    }
                }
                catch (err) {
                    console.log(`Error processing message from player ${player.username}: ${err}`);
                }
            });

            ws.on('close', () => {
                try {
                    console.log('Websocket connection closed for player ' + player.username);
                    player.socket = null;
                    room.broadcastMessage({ type: 'player-disconnected', player: { username: player.username }});
                }
                catch (err) {
                    console.log(`Error on websocket close from player ${player.username}: ${err}`);
                }
            });
        });
    }
    catch (err) {
        console.log(`WebSocket authentication error: ${err}`);
        ws.close(1008, "Unauthorized");
        return;
    }

});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log("Port listening on port " + port);
});