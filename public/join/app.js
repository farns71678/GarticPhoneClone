const gameCodeInput = document.getElementById("game-code-input");
const joinError = document.getElementById("join-error");

gameCodeInput.addEventListener("input", function (event) {
    const updated = this.value.trim();
    const previous = this.getAttribute("previous") || "";
    if (updated === "") {
        this.setAttribute("previous", "");
        this.value = "";
        return;
    }
    const val = parseInt(updated);
    if (isNaN(val)) {
        this.value = previous;
        return;
    }
    const str = val.toString();
    this.value = str.length > 6 ? str.substring(0, 6) : str;
    this.setAttribute("previous", this.value);
});

document.getElementById("join-game-btn").addEventListener("click", async function () {
    const gameCode = gameCodeInput.value.trim();
    const username = document.getElementById("username-input").value.trim();

    // if (gameCode.length < 6) {
    //     joinError.innerText = "Please enter a valid 6-digit game code.";
    //     return;
    // }
    if (!username) {
        joinError.innerText = "Please enter a username.";
        return;
    }

    try {
        this.disabled = true;
        const res = await fetch('/joingame?joinCode=' + encodeURIComponent(gameCode) + '&username=' + encodeURIComponent(username));
        if (!res.ok) {
            const errorData = await res.json();
            joinError.innerText = errorData.error || "Failed to join the game. Please try again.";
            this.disabled = false;
            return;            
        }

        // should be redirected to /play here
        if (res.redirected) {
            window.location.href = res.url;
        }
    }
    catch (error) {
        joinError.innerText = "An error occurred. Please try again.";
        this.disabled = false;
        return;
    }
});