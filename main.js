// Import the API Key from Vite environment
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

let player;
let currentChannelIndex = 0;
let channels = [];

// 1. Fetch our Channel List
async function initApp() {
    const response = await fetch('./channels.json');
    channels = await response.json();
    loadYouTubeAPI();
}

// 2. Load the YT IFrame Script
function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// 3. This runs automatically when the API is ready
window.onYouTubeIframeAPIReady = () => {
    tuneToChannel(0); 
};

function tuneToChannel(index) {
    const channel = channels[index];
    
    // For MVP, we'll assume a hardcoded video ID to test the sync.
    // Real logic will eventually fetch the latest 5 videos from channel.youtubeId.
    const testVideoId = 'dQw4w9WgXcQ'; 
    const startTime = calculateSyncOffset(600); // Assume 10 min (600s) loop

    if (player) {
        player.loadVideoById({
            videoId: testVideoId,
            startSeconds: startTime
        });
    } else {
        player = new YT.Player('player', {
            videoId: testVideoId,
            playerVars: { 
                'autoplay': 1, 
                'controls': 0, 
                'start': startTime,
                'disablekb': 1 
            },
            events: { 'onReady': onPlayerReady }
        });
    }
    showOSD(channel.name, index + 1);
}

// THE MATH: "Seconds Since Midnight" Sync
function calculateSyncOffset(totalDurationSeconds) {
    const now = new Date();
    const secondsSinceMidnight = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    return secondsSinceMidnight % totalDurationSeconds;
}

function showOSD(name, num) {
    const osd = document.getElementById('osd');
    osd.innerHTML = `CH ${num < 10 ? '0'+num : num}<br><span class="text-xl">${name}</span>`;
    osd.classList.remove('hidden');
    setTimeout(() => osd.classList.add('hidden'), 3000);
}

initApp();