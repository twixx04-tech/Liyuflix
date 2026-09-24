// Change this line to your live server link when you launch on Render!
const socket = io("https://onrender.com"); 

const video = document.getElementById('main-video-player');
const landing = document.getElementById('main-landing');
const workspace = document.getElementById('workspace-container');

let chatVisible = true;
let is3DMode = false;
let npcChatterEnabled = true;
let robloxZoomLevel = 4; 
let lastSentRotation = { x: 0, y: 0 };
let aframeSceneEl = null;

// 1. ROUTE INTO ROOM (Optimized File URI Resolver for Android APK)
document.getElementById('btn-enter-flix').addEventListener('click', () => {
    const urlFile = document.getElementById('media-url-picker').value.trim();
    const localFile = document.getElementById('media-file-picker').files;

    if (localFile && localFile.length > 0) {
        // Safe object revocation layer to clear memory overhead leaks
        if (video.src) URL.revokeObjectURL(video.src);
        video.src = URL.createObjectURL(localFile[0]);
    } else if (urlFile) {
        video.src = urlFile;
    } else {
        alert("Please select an offline file or insert a link first!");
        return;
    }
    
    landing.style.display = 'none';
    workspace.style.visibility = 'visible';
    
    // APK Performance Tweak: Set playback rates before loading chunks
    video.load();
    setupDynamicAudioTrackDetection();
});

// 2. TIMELINE PLAYBACK SYNCHRONIZATION 
document.getElementById('btn-play-pause').addEventListener('click', () => {
    const state = video.paused ? 'play' : 'pause';
    socket.emit('sync-action', { action: state, time: video.currentTime });
});

socket.on('sync-action', (data) => {
    video.currentTime = data.time;
    if (data.action === 'play') {
        video.play().catch(err => console.log("Interaction required for APK playback"));
        document.getElementById('btn-play-pause').innerText = "Pause";
    } else {
        video.pause();
        document.getElementById('btn-play-pause').innerText = "Play";
    }
});

// 3. ZOOM / FIT TO SCREEN / CROP LAYOUT OPTIONS
const scaleButtons = {
    'btn-size-orig': '',
    'btn-size-fit': 'fit-mode',
    'btn-size-crop': 'crop-mode'
};

Object.keys(scaleButtons).forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
        document.querySelectorAll('.hud-right button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        video.className = scaleButtons[id];
    });
});

// 4. CHAT HIDING & OVERLAY CONVERSION LOGIC
const btnToggleChat = document.getElementById('btn-toggle-chat');
const sidebar = document.getElementById('chat-sidebar');
const floating = document.getElementById('chat-floating');

btnToggleChat.addEventListener('click', () => {
    chatVisible = !chatVisible;
    if (chatVisible) {
        btnToggleChat.innerText = "Hide Chat";
        btnToggleChat.classList.remove('secondary');
        if (is3DMode) floating.style.display = 'flex';
        else sidebar.classList.remove('hidden');
    } else {
        btnToggleChat.innerText = "Show Chat";
        btnToggleChat.classList.add('secondary');
        sidebar.classList.add('hidden');
        floating.style.display = 'none';
    }
});

// 5. SEND AND RECEIVE LIVE TEXT CHAT MESSAGES
document.getElementById('sidebar-chat-send').addEventListener('click', () => broadcastChatMsg('sidebar-chat-input'));
document.getElementById('floating-chat-send').addEventListener('click', () => broadcastChatMsg('floating-chat-input'));

function broadcastChatMsg(inputId) {
    const inputNode = document.getElementById(inputId);
    const text = inputNode.value.trim();
    if (text) {
        socket.emit('room-message', text);
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

// 6. 3D THEATER SYSTEM - LAZY LOAD PERFORMANCE FIX
const btnToggle3D = document.getElementById('btn-toggle-3d');
const container3D = document.getElementById('theater-3d-container');
const mirrorCanvas = document.getElementById('video-mirror-canvas');
const mirrorCtx = mirrorCanvas.getContext('2d');

btnToggle3D.addEventListener('click', () => {
    is3DMode = !is3DMode;
    if (is3DMode) {
        btnToggle3D.innerText = "Disable 3D View";
        btnToggle3D.classList.remove('secondary');
        container3D.style.visibility = 'visible';
        video.classList.add('hide-native-video'); 
        sidebar.classList.add('hidden'); 
        if (chatVisible) floating.style.display = 'flex';
        
        // Dynamically kickstart WebGL scene calculations *only* when button is selected
        aframeSceneEl = document.querySelector('a-scene');
        if (aframeSceneEl && aframeSceneEl.hasAttribute('paused')) {
            aframeSceneEl.play();
        }
        
        render3DMirrorLoop();
        startHeadTrackingLoop(); 
        runRobloxNPCAnimations();
    } else {
        btnToggle3D.innerText = "Enable 3D View";
        btnToggle3D.classList.add('secondary');
        container3D.style.visibility = 'hidden';
        video.classList.remove('hide-native-video'); 
        floating.style.display = 'none';
        if (chatVisible) sidebar.classList.remove('hidden');
        
        // Pause WebGL rendering loop context to free mobile processor
        if (aframeSceneEl) aframeSceneEl.pause();
    }
});

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
            const mat = screen3D.object3D.children[0].material;
            if (mat && mat.map) mat.map.needsUpdate = true;
        }
    }
    requestAnimationFrame(render3DMirrorLoop);
}

function startHeadTrackingLoop() {
    setInterval(() => {
        if (!is3DMode) return;
        const cameraEl = document.getElementById('main-3d-camera');
        if (cameraEl) {
            const rotation = cameraEl.getAttribute('rotation');
            if (rotation && (Math.abs(rotation.x - lastSentRotation.x) > 2 || Math.abs(rotation.y - lastSentRotation.y) > 2)) {
                lastSentRotation = { x: rotation.x, y: rotation.y };
                socket.emit('head-move', { x: rotation.x, y: rotation.y });
            }
        }
    }, 150); 
}

socket.on('head-move', (data) => {
    const friendHead = document.getElementById('npc-head-2');
    if (friendHead) friendHead.setAttribute('rotation', `${data.x} ${data.y} 0`);
});

// Touch and mobile gesture zoom simulation mapping overrides
window.addEventListener('wheel', (event) => {
    if (!is3DMode) return;
    robloxZoomLevel += event.deltaY * 0.005;
    robloxZoomLevel = Math.max(1.5, Math.min(8, robloxZoomLevel)); 
    document.getElementById('camera-rig').setAttribute('position', `0 2.2 ${robloxZoomLevel}`);
});

// 7. TRACK MULTI-AUDIO DETECTION CHANNELS
function setupDynamicAudioTrackDetection() {
    const selector = document.getElementById('audio-track-selector');
    if (video.audioTracks) {
        selector.innerHTML = '';
        for (let i = 0; i < video.audioTracks.length; i++) {
            const track = video.audioTracks[i];
            const opt = document.createElement('option');
            opt.value = i;
            opt.innerText = track.label || `Audio Track #${i+1} (${track.language})`;
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

// 8. CUSTOM CINEMA LIGHT CONTROLLERS
document.getElementById('light-dimmer-selector').addEventListener('change', (e) => {
    const val = e.target.value;
    document.getElementById('cinema-ambient-light').setAttribute('color', `rgba(${val*40},${val*40},${val*60})`);
    const screenGlow = document.getElementById('screen-emissive-glow');
    if (screenGlow) screenGlow.setAttribute('intensity', val * 2);
});

// 9. AUTOMATED ROBLOX NPC CHATTER SCHEDULER
const npcPhrases = ["Shhh, the movie is starting!", "Wow, LiyuFlix looks amazing.", "Don't throw popcorn at me!", "This part is my favorite!"];
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
    if (npcHead) npcHead.setAttribute('rotation', `${Math.sin(clock)*2} ${Math.cos(clock)*5} 0`);
    requestAnimationFrame(runRobloxNPCAnimations);
}
