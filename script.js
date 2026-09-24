// LINE 2: Change this line to your live server link when you launch on Render!
const socket = io("https://onrender.com"); 

const video = document.getElementById('main-video-player');
const landing = document.getElementById('main-landing');
const workspace = document.getElementById('workspace-container');
const container3D = document.getElementById('theater-3d-container');

let currentRoomCode = "";
let chatVisible = true;
let is3DMode = false;
let npcChatterEnabled = true;
let robloxZoomLevel = 4; 
let lastSentRotation = { x: 0, y: 0 };
let headTrackInterval = null;
let scriptLoaded = false;

// 1. CHROME-DOWNLOADED PATHING (FIXED: Instantly links to local phone path without uploading or memory lag)
document.getElementById('btn-enter-flix').addEventListener('click', () => {
    const roomCode = document.getElementById('sync-room-input').value.trim();
    const urlFile = document.getElementById('media-url-picker').value.trim();
    const filePicker = document.getElementById('media-file-picker');

    if (!roomCode) {
        alert("Please enter a Sync Room Code Name so you can link with your friend!");
        return;
    }

    if (filePicker.files && filePicker.files.length > 0) {
        // Instantly targets the downloaded file on your phone like Chrome's download manager
        video.src = URL.createObjectURL(filePicker.files[0]);
    } else if (urlFile) {
        video.src = urlFile;
    } else {
        alert("Please select a local video file or paste an online video link first!");
        return;
    }

    currentRoomCode = roomCode;
    document.getElementById('room-title-display').innerText = `Room: ${roomCode}`;
    
    // Connect to the room isolated socket track
    socket.emit('join-room', roomCode);

    landing.style.display = 'none';
    workspace.style.visibility = 'visible';
    video.load();
    setupDynamicAudioTrackDetection();
});

// 2. TIMELINE PLAYBACK SYNCHRONIZATION 
document.getElementById('btn-play-pause').addEventListener('click', () => {
    const state = video.paused ? 'play' : 'pause';
    socket.emit('sync-action', { room: currentRoomCode, action: state, time: video.currentTime });
});

socket.on('sync-action', (data) => {
    video.currentTime = data.time;
    if (data.action === 'play') {
        video.play().catch(() => {});
        document.getElementById('btn-play-pause').innerText = "Pause";
    } else {
        video.pause();
        document.getElementById('btn-play-pause').innerText = "Play";
    }
});

// 3. ZOOM / FIT TO SCREEN / CROP LAYOUT OPTIONS
const scaleButtons = { 'btn-size-orig': '', 'btn-size-fit': 'fit-mode', 'btn-size-crop': 'crop-mode' };
Object.keys(scaleButtons).forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
        document.querySelectorAll('.hud-right button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        video.className = scaleButtons[id];
    });
});

// 4. CHAT HIDING & FLOATING OVERLAY MANAGEMENT
const btnToggleChat = document.getElementById('btn-toggle-chat');
const sidebar = document.getElementById('chat-sidebar');
const floating = document.getElementById('chat-floating');

btnToggleChat.addEventListener('click', () => {
    chatVisible = !chatVisible;
    if (chatVisible) {
        btnToggleChat.innerText = "Hide Chat";
        if (is3DMode) floating.style.display = 'flex';
        else sidebar.classList.remove('hidden');
    } else {
        btnToggleChat.innerText = "Show Chat";
        sidebar.classList.add('hidden');
        floating.style.display = 'none';
    }
});

// 5. SEND AND RECEIVE ROOM TEXTS
document.getElementById('sidebar-chat-send').addEventListener('click', () => broadcastChatMsg('sidebar-chat-input'));
document.getElementById('floating-chat-send').addEventListener('click', () => broadcastChatMsg('floating-chat-input'));
function broadcastChatMsg(inputId) {
    const inputNode = document.getElementById(inputId);
    const text = inputNode.value.trim();
    if (text) {
        socket.emit('room-message', { room: currentRoomCode, text: text });
        renderMessageWindow("You", text);
        inputNode.value = '';
    }
}
socket.on('room-message', (data) => renderMessageWindow("Friend", data.text));
function renderMessageWindow(sender, string) {
    const frameTemplate = `<div class="chat-row-msg"><b>${sender}:</b> ${string}</div>`;
    document.getElementById('sidebar-chat-body').innerHTML += frameTemplate;
    document.getElementById('floating-chat-body').innerHTML += frameTemplate;
}

// 6. 3D THEATER SYSTEM LAZY-LOADING INJECTOR ENGINE
const btnToggle3D = document.getElementById('btn-toggle-3d');
const mirrorCanvas = document.getElementById('video-mirror-canvas');
const mirrorCtx = mirrorCanvas.getContext('2d');

btnToggle3D.addEventListener('click', () => {
    is3DMode = !is3DMode;
    if (is3DMode) {
        btnToggle3D.innerText = "Disable 3D View";
        document.getElementById('light-dimmer-selector').style.display = 'inline-block';
        document.getElementById('btn-npc-bubble').style.display = 'inline-block';
        
        if (!scriptLoaded) {
            // Lazy-load the heavy A-Frame framework ONLY when clicked to prevent site freezing
            const script = document.createElement('script');
            script.src = "https://aframe.io";
            script.onload = () => {
                scriptLoaded = true;
                build3DSceneHTML();
                activate3DMode();
            };
            document.head.appendChild(script);
        } else {
            build3DSceneHTML();
            activate3DMode();
        }
    } else {
        btnToggle3D.innerText = "Enable 3D View";
        document.getElementById('light-dimmer-selector').style.display = 'none';
        document.getElementById('btn-npc-bubble').style.display = 'none';
        deactivate3DMode();
    }
});

function build3DSceneHTML() {
    container3D.innerHTML = `
        <a-scene embedded vr-mode-ui="enabled: false" renderer="antialias: false; precision: medium;">
            
            <a-video id="3d-cinema-screen" src="#video-mirror-canvas" width="12" height="6.75" position="0 4.5 -6"></a-video>
            <a-box position="0 4.5 -6.05" width="12.3" height="7.05" depth="0.05" color="#050505"></a-box>
            <a-sky color="#020205"></a-sky><a-plane rotation="-90 0 0" width="30" height="30" color="#08080c"></a-plane>
            <a-light id="cinema-ambient-light" type="ambient" color="#0b0b0f"></a-light>
            <a-light id="screen-emissive-glow" type="point" intensity="0.4" position="0 4.5 -4" color="#ffffff"></a-light>
            <!-- ROW 1 (Couples Seats Red) -->
            
            
            
            
            <!-- ROW 2 (Default Occupied Target) -->
            
            
            
            
            <!-- ROBLOX STATUE NPCs -->
            <a-box width="0.5" height="0.6" depth="0.3" color="#2e86de"></a-box><a-box id="npc-head-1" position="0 0.5 0" width="0.32" height="0.32" depth="0.32" color="#ffdbac"></a-box>
            <a-box width="0.5" height="0.6" depth="0.3" color="#10ac84"></a-box><a-box id="npc-head-2" position="0 0.5 0" width="0.32" height="0.32" depth="0.32" color="#e0ac69"></a-box>
        </a-scene>
    `;
}

function activate3DMode() {
    container3D.style.display = 'block';
    video.classList.add('hide-native-video'); 
    sidebar.classList.add('hidden'); 
    if (chatVisible) floating.style.display = 'flex';
    
    render3DMirrorLoop();
    
    // Monitors head movement angles and reports changes to your partner
    headTrackInterval = setInterval(() => {
        const cameraEl = document.getElementById('main-3d-camera');
        if (cameraEl) {
            const rotation = cameraEl.getAttribute('rotation');
            if (rotation && (Math.abs(rotation.x - lastSentRotation.x) > 2 || Math.abs(rotation.y - lastSentRotation.y) > 2)) {
                lastSentRotation = { x: rotation.x, y: rotation.y };
                socket.emit('head-move', { room: currentRoomCode, x: rotation.x, y: rotation.y });
            }
        }
    }, 150);
    runRobloxNPCAnimations();
}

function deactivate3DMode() {
    container3D.style.display = 'none';
    container3D.innerHTML = ''; // Clear WebGL bindings out of memory completely
    video.classList.remove('hide-native-video'); 
    floating.style.display = 'none';
    if (chatVisible) sidebar.classList.remove('hidden');
    clearInterval(headTrackInterval);
}

function render3DMirrorLoop() {
    if (!is3DMode) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
if (mirrorCanvas.width !== video.videoWidth) {
mirrorCanvas.width = video.videoWidth;
mirrorCanvas.height = video.videoWidth * (9/16);
}
mirrorCtx.drawImage(video, 0, 0, mirrorCanvas.width, mirrorCanvas.height);
const screen3D = document.getElementById('3d-cinema-screen');
if(screen3D && screen3D.object3D.children.length > 0) {
const mat = screen3D.object3D.children.material;
if (mat && mat.map) mat.map.needsUpdate = true;
}
}
requestAnimationFrame(render3DMirrorLoop);
}
socket.on('head-move', (data) => {
if(!is3DMode) return;
// Angles friend's head block live based on their phone panning vectors
const friendHead = document.getElementById('npc-head-2');
    if (friendHead) friendHead.setAttribute('rotation', ${data.x} ${data.y} 0);
});
// Roblox Scroll Zoom
window.addEventListener('wheel', (event) => {
if (!is3DMode) return;
robloxZoomLevel += event.deltaY * 0.005;
robloxZoomLevel = Math.max(1.5, Math.min(8, robloxZoomLevel));
const rig = document.getElementById('camera-rig');
if(rig) rig.setAttribute('position', 0 2.2 ${robloxZoomLevel});
});
function setupDynamicAudioTrackDetection() {
const selector = document.getElementById('audio-track-selector');
if (video.audioTracks) {
selector.innerHTML = '';
for (let i = 0; i < video.audioTracks.length; i++) {
const track = video.audioTracks[i];
const opt = document.createElement('option');
opt.value = i;
opt.innerText = track.label || Audio Track #${i+1};
if (track.enabled) opt.selected = true;
selector.appendChild(opt);
}
selector.addEventListener('change', (e) => {
for (let i = 0; i < video.audioTracks.length; i++) {
video.audioTracks[i].enabled = (i == e.target.value);
}
});
}
}
document.getElementById('light-dimmer-selector').addEventListener('change', (e) => {
if(!is3DMode) return;
const val = e.target.value;
document.getElementById('cinema-ambient-light').setAttribute('color', rgba(${val*40},${val*40},${val*60}));
const screenGlow = document.getElementById('screen-emissive-glow');
if (screenGlow) screenGlow.setAttribute('intensity', val * 2);
});
const npcPhrases = ["Shhh, the movie is starting!", "Wow, LiyuFlix looks amazing.", "Don't throw popcorn at me!"];
document.getElementById('btn-npc-bubble').addEventListener('click', (e) => {
npcChatterEnabled = !npcChatterEnabled;
e.target.innerText = npcChatterEnabled ? "NPC Chatter: On" : "NPC Chatter: Off";
});
setInterval(() => {
if (npcChatterEnabled && !video.paused && is3DMode) {
    const randomText = npcPhrases[Math.floor(Math.random() * npcPhrases.length)];
renderMessageWindow("Roblox_Seat_NPC", randomText);
}
}, 15000);
function runRobloxNPCAnimations() {
if (!is3DMode) return;
let clock = Date.now() * 0.002;
const npcHead = document.getElementById('npc-head-1');
if (npcHead) npcHead.setAttribute('rotation', ${Math.sin(clock)*2} ${Math.cos(clock)*5} 0);
requestAnimationFrame(runRobloxNPCAnimations);
}