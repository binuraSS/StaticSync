/**
 * StaticSync: The Main Tuner Logic (Clean Version)
 */

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
let player = null;
let channels = [];
let currentChannelIndex = 0;
const VIDEO_DURATION_DEFAULT = 600; 

// 1. INITIALIZATION
async function initApp() {
    try {
        const response = await fetch('./channels.json');
        channels = await response.json();
        if (channels.length === 0) return;
        loadYouTubeIframeAPI();
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

function loadYouTubeIframeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = () => {
    tuneToChannel(0);
};

// 2. DATA FETCHING
async function getChannelVideos(youtubeId) {
    const storageKey = `cache_${youtubeId}`;
    const cachedData = localStorage.getItem(storageKey);
    
    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const age = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
        if (age < 12) return parsed.videos;
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${youtubeId}&part=snippet,id&order=date&maxResults=5&type=video`
        );
        const data = await response.json();
        const videos = data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title
        }));

        localStorage.setItem(storageKey, JSON.stringify({
            timestamp: Date.now(),
            videos: videos
        }));
        return videos;
    } catch (error) {
        console.error("API Error:", error);
        return [];
    }
}

// 3. THE TUNER (ONE VERSION ONLY)
async function tuneToChannel(index) {
    // Show static and OSD immediately
    const staticOverlay = document.getElementById('static-overlay');
    if(staticOverlay) staticOverlay.style.opacity = "1"; 
    
    currentChannelIndex = index;
    const channel = channels[index];
    showOSD(channel.name, index + 1);

    const videos = await getChannelVideos(channel.youtubeId);
    if (!videos || videos.length === 0) return;

    // Time-Sync Math
    const totalLoopTime = videos.length * VIDEO_DURATION_DEFAULT;
    const now = new Date();
    const secondsSinceMidnight = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    const totalOffset = secondsSinceMidnight % totalLoopTime;

    const videoIndex = Math.floor(totalOffset / VIDEO_DURATION_DEFAULT);
    const startSeconds = totalOffset % VIDEO_DURATION_DEFAULT;
    const targetVideo = videos[videoIndex];

    // Hide static after 400ms delay
    setTimeout(() => {
        if(staticOverlay) staticOverlay.style.opacity = "0";
    }, 400); 

    if (!player) {
        player = new YT.Player('player', {
            videoId: targetVideo.id,
            playerVars: {
                'autoplay': 1,
                'controls': 0,
                'start': startSeconds,
                'modestbranding': 1,
                'rel': 0,
                'disablekb': 1
            },
            events: {
                'onReady': (event) => event.target.playVideo(),
                'onStateChange': (event) => {
                    if (event.data === YT.PlayerState.ENDED) tuneToChannel(currentChannelIndex);
                }
            }
        });
    } else {
        player.loadVideoById({
            videoId: targetVideo.id,
            startSeconds: startSeconds
        });
    }
}

// 4. UI ELEMENTS
function showOSD(name, num) {
    const osd = document.getElementById('osd');
    if (!osd) return;
    const displayNum = num < 10 ? `0${num}` : num;
    osd.innerHTML = `CH ${displayNum}<br><span class="text-xl">${name.toUpperCase()}</span>`;
    osd.classList.remove('hidden');
    setTimeout(() => osd.classList.add('hidden'), 3000);
}

// 5. INPUTS
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
        let next = (currentChannelIndex + 1) % channels.length;
        tuneToChannel(next);
    }
    if (e.key === 'ArrowDown') {
        let prev = (currentChannelIndex - 1 + channels.length) % channels.length;
        tuneToChannel(prev);
    }
});

// 6. POWER BUTTON FIX (FOR SAFARI)
document.addEventListener('DOMContentLoaded', () => {
    const powerBtn = document.getElementById('power-btn');
    if (powerBtn) {
        powerBtn.addEventListener('click', () => {
            document.getElementById('power-on-screen').classList.add('hidden');
            initApp(); 
        });
    } else {
        // If you don't use the power button screen, just init
        initApp();
    }
});