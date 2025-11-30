const WebSocket = require('ws');

const GameStage = {
    LOBBY: 'lobby',
    PROMPT: 'prompt',
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
        this.round = 0;
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

    advanceRound() {
        this.round += 1;
        if (this.round >= this.players.length) {
            this.endGame();
            return;
        }

        this.stage = this.stage === GameStage.DRAWING ? GameStage.GUESSING : GameStage.DRAWING;
        this.players.forEach((player, index) => {
            if (player.socket && player.socket.readyState === WebSocket.OPEN) {
                const promptIndex = (index + (this.players.length - this.round)) % this.players.length;
                if (this.stage === GameStage.DRAWING) {
                    const prompt = this.round == 1 ? this.players[promptIndex].startingPrompt : this.players[promptIndex].guesses[this.round - 2];
                    player.socket.send(JSON.stringify({ type: 'drawing-stage', prompt: prompt}));
                }
                else if (this.stage === GameStage.GUESSING) {
                    const drawing = this.players[promptIndex].pictures[this.round - 1];
                    player.socket.send(JSON.stringify({ type: 'guessing-stage', drawing: JSON.stringify(drawing) }));
                }
            }
        })
    }

    endGame() {
        this.stage = GameStage.RESULTS;
        this.broadcastMessage({ type: 'result-stage' });
    }
}

module.exports = GameRoom;