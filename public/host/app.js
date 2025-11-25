const hostErr = document.getElementById("host-error");
const socketUrl = "ws://localhost:3000/joinroom";
let socket = null;

document.getElementById("host-game-btn").addEventListener("click", async function () {
    const username = document.getElementById("user-name").value.trim();
    if (!username) {
        hostErr.innerText = "Please enter a username.";
        return;
    }

    try {
        this.disabled = true;
        let res = await fetch('/hostgame?username=' + encodeURIComponent(username));
        if (!res.ok) {
            let data = await res.json();
            hostErr.innerText = data.error || "Failed to create a game room. Please try again.";
            this.disabled = false;
            return;
        }

        if (res.redirected) {
            window.location.href = res.url;
        }
    } catch (error) {
        hostErr.innerText = "An error occurred. Please try again.";
        this.disabled = false;
        return;
    }
});