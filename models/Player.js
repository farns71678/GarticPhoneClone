class Player {
    constructor(id, username) {
        this.id = id;
        this.username = username;
        this.socket = null;
        this.startingPrompt = "";
        // these are the player's drawings and guesses for each roudn
        this.pictures = [];
        this.guesses = [];
    }
}

module.exports = Player;