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
        this.timeout = null;
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

    startGame() {
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].guesses = new Array(Math.floor(this.players.length / 2));
            this.players[i].drawings = new Array(Math.ceil(this.players.length / 2));
        }
        this.advanceRound();
    }

    advanceRound() {
        this.round += 1;
        if (this.round >= this.players.length) {
            this.endGame();
            return;
        }

        this.stage = this.stage === GameStage.DRAWING ? GameStage.GUESSING : GameStage.DRAWING;
        const startTime = Date.now();
        this.players.forEach((player, index) => {
            if (player.socket && player.socket.readyState === WebSocket.OPEN) {
                const promptIndex = (index + this.round) % this.players.length;
                if (this.stage === GameStage.DRAWING) {
                    const prompt = this.round == 1 ? this.players[promptIndex].startingPrompt : this.players[promptIndex].guesses[Math.floor(this.round / 2) - 2];
                    player.socket.send(JSON.stringify({ type: 'drawing-stage', prompt: prompt, round: this.round, startTime }));
                }
                else if (this.stage === GameStage.GUESSING) {
                    const drawing = this.players[promptIndex].drawings[Math.floor(this.round / 2) - 1];
                    player.socket.send(JSON.stringify({ type: 'guessing-stage', drawing: drawing, round: this.round, startTime }));
                }
            }
        });

        if (this.stage === GameStage.GUESSING || this.stage === GameStage.DRAWING) {
            const room = this;
            // adds a bit of buffer to wait for the players to respond
            this.timeout = setTimeout(() => room.advanceRound(), 1000 * 60 * 2 + 500);
        } 
    }

    checkAdvance() {
        const room = this;
        if (this.players.every(player => room.stage === GameStage.GUESSING ? player.guesses[Math.floor(room.round / 2) - 1] : player.drawings[Math.floor(room.round / 2)])) {
            clearTimeout(this.timeout);
            this.advanceRound();
        }
    }

    endGame() {
        this.stage = GameStage.RESULTS;
        this.broadcastMessage({ 
            type: 'results-stage',
            players: this.players.map(p => { return { id: p.id, username: p.username, startingPrompt: p.startingPrompt, drawings: p.drawings, guesses: p.guesses }; })
        });
    }
}

module.exports = GameRoom;