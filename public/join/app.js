const gameCodeInput = document.getElementById("game-code-input");
const joinError = document.getElementById("join-error");

gameCodeInput.addEventListener("keydown", function (event) {
    if (isNaN(parseInt(event.key)) && event.key !== "Backspace" && event.key !== "Delete" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        event.preventDefault();
    }
});

document.getElementById("join-game-btn").addEventListener("click", async function () {
    const gameCode = gameCodeInput.value.trim();
    const username = document.getElementById("username-input").value.trim();

    if (gameCode.length < 6) {
        joinError.innerText = "Please enter a valid 6-digit game code.";
        return;
    }
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