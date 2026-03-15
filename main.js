/**
 * StaticSync: The Main Tuner Logic
 */

// 1. STATE MANAGEMENT
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
let player = null;
let channels = [];
let currentChannelIndex = 0;
const VIDEO_DURATION_DEFAULT = 600; // 10 minutes per video for sync logic

// 2. INITIALIZATION
async function initApp() {
    try {
        // Load your channel list from the JSON file
        const response = await fetch('./channels.json');
        channels = await response.json();

        if (channels.length === 0) {
            console.error("No channels found in channels.json");
            return;
        }

        // Initialize the YouTube IFrame API
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

// 3. YOUTUBE API CALLBACKS
// This must be on the window object for the YT script to find it
window.onYouTubeIframeAPIReady = () => {
    console.log("YouTube API Ready. Initializing tuner...");
    tuneToChannel(0);
};

// 4. DATA FETCHING (With Cache-First Logic)
async function getChannelVideos(youtubeId) {
    const storageKey = `cache_${youtubeId}`;
    const cachedData = localStorage.getItem(storageKey);
    
    // Check if we have data less than 12 hours old
    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const age = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
        if (age < 12) return parsed.videos;
    }

    // Otherwise, fetch from YouTube (Costs 100 quota units)
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${youtubeId}&part=snippet,id&order=date&maxResults=5&type=video`
        );
        const data = await response.json();
        
        if (!data.items) throw new Error("Invalid API Response");

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

// 5. TUNING & SYNC LOGIC
async function tuneToChannel(index) {
    currentChannelIndex = index;
    const channel = channels[index];
    
    // Show the OSD (On-Screen Display) immediately
    showOSD(channel.name, index + 1);

    const videos = await getChannelVideos(channel.youtubeId);
    if (!videos || videos.length === 0) return;

    // MATH: Calculate where we are in the "Broadcast Day"
    const totalLoopTime = videos.length * VIDEO_DURATION_DEFAULT;
    const now = new Date();
    const secondsSinceMidnight = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    const totalOffset = secondsSinceMidnight % totalLoopTime;

    const videoIndex = Math.floor(totalOffset / VIDEO_DURATION_DEFAULT);
    const startSeconds = totalOffset % VIDEO_DURATION_DEFAULT;
    const targetVideo = videos[videoIndex];

    // If player doesn't exist, create it. Otherwise, load the new video.
    if (!player) {
        player = new YT.Player('player', {
            videoId: targetVideo.id,
            playerVars: {
                'autoplay': 1,
                'controls': 0, // No controls for the retro TV feel
                'start': startSeconds,
                'modestbranding': 1,
                'rel': 0,
                'disablekb': 1
            },
            events: {
                'onReady': (event) => event.target.playVideo(),
                'onStateChange': onPlayerStateChange
            }
        });
    } else {
        player.loadVideoById({
            videoId: targetVideo.id,
            startSeconds: startSeconds
        });
    }
}

function onPlayerStateChange(event) {
    // If a video ends, re-tune to the current channel 
    // to jump to the next video in the "schedule"
    if (event.data === YT.PlayerState.ENDED) {
        tuneToChannel(currentChannelIndex);
    }
}

// 6. UI & INTERACTION
function showOSD(name, num) {
    const osd = document.getElementById('osd');
    if (!osd) return;
    
    const displayNum = num < 10 ? `0${num}` : num;
    osd.innerHTML = `CH ${displayNum}<br><span class="text-xl text-green-500">${name.toUpperCase()}</span>`;
    osd.classList.remove('hidden');
    
    // Hide OSD after 3 seconds
    setTimeout(() => {
        osd.classList.add('hidden');
    }, 3000);
}
async function tuneToChannel(index) {
    // 1. Show the Static and OSD immediately
    const staticOverlay = document.getElementById('static-overlay');
    if(staticOverlay) staticOverlay.style.opacity = "1"; 
    
    currentChannelIndex = index;
    const channel = channels[index];
    showOSD(channel.name, index + 1);

    const videos = await getChannelVideos(channel.youtubeId);
    if (!videos || videos.length === 0) return;

    // ... (Your existing sync math code here) ...

    // 2. Hide the static after a small delay (simulates the "tube" warming up)
    setTimeout(() => {
        if(staticOverlay) staticOverlay.style.opacity = "0";
    }, 400); 

    // Update the player as usual
    if (!player) {
        /* ... create player code ... */
    } else {
        player.loadVideoById({
            videoId: targetVideo.id,
            startSeconds: startSeconds
        });
    }
}

// Keyboard Surfing
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
        let next = currentChannelIndex + 1;
        if (next >= channels.length) next = 0;
        tuneToChannel(next);
    }
    if (e.key === 'ArrowDown') {
        let prev = currentChannelIndex - 1;
        if (prev < 0) prev = channels.length - 1;
        tuneToChannel(prev);
    }
});

// START THE APP
initApp();