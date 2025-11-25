class Player {
    constructor(id, username) {
        this.id = id;
        this.username = username;
        this.socket = null;
    }
}

module.exports = Player;