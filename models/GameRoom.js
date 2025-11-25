const WebSocket = require('ws');

const GameStage = {
    LOBBY: 'lobby',
    DRAWING: 'drawing',
    GUESSING: 'guessing',
    RESULTS: 'results'
};

class GameRoom {
    constructor(id, joinCode, host, players = []) {
        this.id = id;
        this.joinCode = joinCode;
        this.players = players;
        this.host = host;
        this.stage = GameStage.LOBBY;
        this.addPlayer(this.host);
    }

    addPlayer(player) {
        this.players.push(player);

        // message existing players about new player
        this.broadcastMessage({ type: 'player-connected', player: { username: player.username } });
    }

    broadcastMessage(message) {
        this.players.forEach(player => {
            if (player.socket && player.socket.readyState === WebSocket.OPEN) {
                player.socket.send(JSON.stringify(message));
            }
        });
    }
}

module.exports = GameRoom;