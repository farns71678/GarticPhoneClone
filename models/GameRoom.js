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
    }
}

module.exports = GameRoom;