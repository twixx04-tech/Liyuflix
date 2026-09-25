/*
 * ============================================================
 * WATCH TOGETHER CLIENT
 * ============================================================
 *
 * IMPORTANT:
 *
 * Before deploying, replace the value below with your
 * Render WebSocket URL.
 *
 * Example:
 *
 * const SIGNAL_SERVER_URL =
 *     "wss://watch-together-server.onrender.com";
 *
 * ============================================================
 */

const SIGNAL_SERVER_URL =
    "https://liyuflix-backend-1.onrender.com";


/*
 * ============================================================
 * ELEMENTS
 * ============================================================
 */

const lobby = document.getElementById("lobby");

const watchRoom =
    document.getElementById("watchRoom");

const nameInput =
    document.getElementById("nameInput");

const roomInput =
    document.getElementById("roomInput");

const createRoomButton =
    document.getElementById("createRoomButton");

const joinRoomButton =
    document.getElementById("joinRoomButton");

const lobbyStatus =
    document.getElementById("lobbyStatus");

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");

const presence =
    document.getElementById("presence");

const videoFile =
    document.getElementById("videoFile");

const fileName =
    document.getElementById("fileName");

const video =
    document.getElementById("video");

const messages =
    document.getElementById("messages");

const chatForm =
    document.getElementById("chatForm");

const chatInput =
    document.getElementById("chatInput");


/*
 * ============================================================
 * STATE
 * ============================================================
 */

let socket = null;

let currentRoomCode = "";

let myName = "";

let localVideoURL = null;

/*
 * When true, a video event came from the other person.
 *
 * This prevents:
 *
 * Friend A -> play
 * Friend B -> play
 * Friend A -> play
 * Friend B -> play
 *
 * becoming an infinite loop.
 */
let applyingRemoteState = false;


/*
 * ============================================================
 * UI HELPERS
 * ============================================================
 */

function setLobbyStatus(message) {
    lobbyStatus.textContent = message;
}

function getName() {
    return nameInput.value.trim().slice(0, 24);
}

function getRoomCode() {
    return roomInput.value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
}


/*
 * ============================================================
 * WEBSOCKET
 * ============================================================
 */

function connectToServer() {

    if (
        !SIGNAL_SERVER_URL ||
        SIGNAL_SERVER_URL.includes("YOUR-RENDER-SERVICE")
    ) {
        setLobbyStatus(
            "First set your Render WebSocket URL in app.js."
        );

        return null;
    }

    if (socket) {
        try {
            socket.close();
        } catch {
            // Nothing to do.
        }
    }

    socket = new WebSocket(SIGNAL_SERVER_URL);

    socket.addEventListener("open", () => {

        setLobbyStatus("Connected to server.");

        /*
         * The actual create/join message is sent by
         * the caller after this connection opens.
         */
    });

    socket.addEventListener("message", handleServerMessage);

    socket.addEventListener("error", () => {

        setLobbyStatus(
            "Could not connect to the server."
        );
    });

    socket.addEventListener("close", () => {

        if (!watchRoom.hidden) {

            presence.textContent =
                "Disconnected from server";
        }
    });

    return socket;
}


/*
 * ============================================================
 * SEND
 * ============================================================
 */

function send(data) {

    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {
        return false;
    }

    socket.send(JSON.stringify(data));

    return true;
}


/*
 * ============================================================
 * CREATE ROOM
 * ============================================================
 */

createRoomButton.addEventListener("click", () => {

    myName = getName();

    if (!myName) {
        setLobbyStatus("Enter your name first.");
        return;
    }

    const ws = connectToServer();

    if (!ws) {
        return;
    }

    const handleOpen = () => {

        send({
            type: "create-room",
            name: myName
        });

        ws.removeEventListener(
            "open",
            handleOpen
        );
    };

    ws.addEventListener(
        "open",
        handleOpen
    );
});


/*
 * ============================================================
 * JOIN ROOM
 * ============================================================
 */

joinRoomButton.addEventListener("click", () => {

    myName = getName();

    const roomCode = getRoomCode();

    if (!myName) {
        setLobbyStatus("Enter your name first.");
        return;
    }

    if (roomCode.length !== 6) {
        setLobbyStatus(
            "Enter a valid 6-character room code."
        );

        return;
    }

    const ws = connectToServer();

    if (!ws) {
        return;
    }

    const handleOpen = () => {

        send({
            type: "join-room",
            name: myName,
            roomCode
        });

        ws.removeEventListener(
            "open",
            handleOpen
        );
    };

    ws.addEventListener(
        "open",
        handleOpen
    );
});


/*
 * ============================================================
 * SERVER MESSAGE HANDLER
 * ============================================================
 */

function handleServerMessage(event) {

    let message;

    try {
        message = JSON.parse(event.data);
    } catch {
        return;
    }


    /*
     * ROOM CREATED
     */

    if (message.type === "room-created") {

        enterRoom(message.roomCode);

        return;
    }


    /*
     * ROOM JOINED
     */

    if (message.type === "room-joined") {

        enterRoom(message.roomCode);

        return;
    }


    /*
     * PRESENCE
     */

    if (message.type === "presence") {

        if (message.count === 2) {

            presence.textContent =
                "2 people connected";

        } else {

            presence.textContent =
                "Waiting for friend...";
        }

        return;
    }


    /*
     * SOMEONE JOINED
     *
     * The existing user sends its current video state.
     */

    if (message.type === "peer-joined") {

        sendCurrentVideoState();

        return;
    }


    /*
     * VIDEO SYNC
     */

    if (message.type === "video-sync") {

        applyRemoteVideoState(message);

        return;
    }


    /*
     * CHAT
     */

    if (message.type === "chat") {

        addMessage(
            message.name || "Friend",
            message.message
        );

        return;
    }


    /*
     * ERROR
     */

    if (message.type === "error") {

        setLobbyStatus(message.message);

        return;
    }
}


/*
 * ============================================================
 * ENTER ROOM
 * ============================================================
 */

function enterRoom(roomCode) {

    currentRoomCode = roomCode;

    roomCodeDisplay.textContent =
        currentRoomCode;

    lobby.hidden = true;

    watchRoom.hidden = false;

    setLobbyStatus("");

    /*
     * Put the room code in the URL.
     *
     * Example:
     *
     * https://your-site.vercel.app/?room=ABC123
     *
     * This does NOT automatically join the room.
     * It simply makes the room easier to share.
     */

    const url =
        new URL(window.location.href);

    url.searchParams.set(
        "room",
        currentRoomCode
    );

    window.history.replaceState(
        {},
        "",
        url
    );
}


/*
 * ============================================================
 * LOCAL VIDEO FILE
 * ============================================================
 */

videoFile.addEventListener("change", () => {

    const file = videoFile.files[0];

    if (!file) {
        return;
    }


    /*
     * Revoke the previous object URL.
     */

    if (localVideoURL) {

        URL.revokeObjectURL(
            localVideoURL
        );

        localVideoURL = null;
    }


    /*
     * IMPORTANT:
     *
     * The movie itself stays on this device.
     *
     * URL.createObjectURL() gives the browser's
     * <video> element access to the local file.
     */

    localVideoURL =
        URL.createObjectURL(file);

    video.src = localVideoURL;

    video.load();

    fileName.textContent =
        file.name;
});


/*
 * ============================================================
 * VIDEO -> OTHER PERSON
 * ============================================================
 */


/*
 * PLAY
 */

video.addEventListener("play", () => {

    if (applyingRemoteState) {
        return;
    }

    sendVideoEvent(
        "play",
        video.currentTime
    );
});


/*
 * PAUSE
 */

video.addEventListener("pause", () => {

    if (applyingRemoteState) {
        return;
    }

    sendVideoEvent(
        "pause",
        video.currentTime
    );
});


/*
 * SEEK
 *
 * "seeked" fires after the user has finished seeking.
 */

video.addEventListener("seeked", () => {

    if (applyingRemoteState) {
        return;
    }

    sendVideoEvent(
        "seek",
        video.currentTime
    );
});


function sendVideoEvent(action, time) {

    if (!Number.isFinite(time)) {
        return;
    }

    send({
        type: "video-sync",
        action,
        time,
        sentAt: Date.now()
    });
}


/*
 * ============================================================
 * REMOTE VIDEO STATE
 * ============================================================
 */

function applyRemoteVideoState(message) {

    if (!video.src) {
        return;
    }

    const remoteTime =
        Number(message.time);

    if (!Number.isFinite(remoteTime)) {
        return;
    }


    /*
     * Estimate how long the message spent travelling.
     *
     * This makes PLAY slightly more accurate.
     */

    let targetTime = remoteTime;

    if (
        message.action === "play" &&
        Number.isFinite(message.sentAt)
    ) {

        const delay =
            (Date.now() - message.sentAt) / 1000;

        /*
         * Don't allow a crazy clock/network value.
         */

        const safeDelay =
            Math.max(
                0,
                Math.min(delay, 2)
            );

        targetTime += safeDelay;
    }


    applyingRemoteState = true;


    /*
     * Correct large time differences.
     */

    const difference =
        Math.abs(
            video.currentTime - targetTime
        );

    if (difference > 0.15) {

        try {
            video.currentTime = targetTime;
        } catch {
            // Video may not be ready yet.
        }
    }


    /*
     * Apply PLAY / PAUSE.
     */

    if (message.action === "play") {

        video.play()
            .catch(() => {
                /*
                 * Browser autoplay restrictions can prevent
                 * play() until the user interacts with the page.
                 */
            });

    } else if (message.action === "pause") {

        video.pause();
    }


    /*
     * Give the browser a moment before allowing
     * local events to be sent again.
     */

    setTimeout(() => {

        applyingRemoteState = false;

    }, 100);
}


/*
 * ============================================================
 * CURRENT VIDEO STATE
 * ============================================================
 */

function sendCurrentVideoState() {

    if (!video.src) {
        return;
    }

    send({
        type: "video-state",
        time: video.currentTime || 0,
        playing: !video.paused,
        sentAt: Date.now()
    });
}


/*
 * ============================================================
 * CHAT
 * ============================================================
 */

chatForm.addEventListener("submit", (event) => {

    event.preventDefault();

    const text =
        chatInput.value.trim();

    if (!text) {
        return;
    }

    const safeText =
        text.slice(0, 500);

    /*
     * Show our own message immediately.
     */

    addMessage(
        "You",
        safeText
    );

    /*
     * Send it to the other person.
     */

    send({
        type: "chat",
        message: safeText
    });

    chatInput.value = "";

    chatInput.focus();
});


function addMessage(name, text) {

    const messageElement =
        document.createElement("div");

    messageElement.className =
        "message";


    const nameElement =
        document.createElement("span");

    nameElement.className =
        "messageName";

    nameElement.textContent =
        name + ":";


    /*
     * IMPORTANT:
     *
     * Use textContent instead of innerHTML.
     *
     * This prevents somebody from injecting HTML/JS
     * through the chat box.
     */

    const textElement =
        document.createElement("span");

    textElement.textContent =
        text;


    messageElement.appendChild(
        nameElement
    );

    messageElement.appendChild(
        textElement
    );

    messages.appendChild(
        messageElement
    );


    /*
     * Scroll to latest message.
     */

    messages.scrollTop =
        messages.scrollHeight;
}


/*
 * ============================================================
 * ROOM CODE FROM URL
 * ============================================================
 *
 * If somebody opens:
 *
 * ?room=ABC123
 *
 * put the code into the join field automatically.
 *
 * They still have to press Join Room.
 */

const urlParams =
    new URLSearchParams(
        window.location.search
    );

const roomFromURL =
    urlParams.get("room");

if (roomFromURL) {

    roomInput.value =
        roomFromURL
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 6);
}


/*
 * ============================================================
 * CLEANUP
 * ============================================================
 */

window.addEventListener("beforeunload", () => {

    if (localVideoURL) {

        URL.revokeObjectURL(
            localVideoURL
        );
    }

    if (socket) {

        try {
            socket.close();
        } catch {
            // Nothing to do.
        }
    }
});
