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
    if (window.YT) return; 
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = () => {
    tuneToChannel(0);
};

// 2. DATA FETCHING (No Shorts / 4m+ Videos)
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
            `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${youtubeId}&part=snippet,id&order=date&maxResults=15&type=video&videoDuration=medium`
        );
        const data = await response.json();
        
        const videos = data.items
            .filter(item => {
                const title = item.snippet.title.toLowerCase();
                return !title.includes('shorts') && !title.includes('#short') && item.id.videoId;
            })
            .map(item => ({
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
        return [{ id: 'v67R_pYf-3g', title: 'Test Signal' }];
    }
}

// 3. THE TUNER
async function tuneToChannel(index) {
    const staticOverlay = document.getElementById('static-overlay');
    if (staticOverlay) staticOverlay.style.opacity = "1"; 
    
    currentChannelIndex = index;
    const channel = channels[index];
    showOSD(channel.name, index + 1);

    const videos = await getChannelVideos(channel.youtubeId);
    if (!videos || videos.length === 0) return;

    const totalLoopTime = videos.length * VIDEO_DURATION_DEFAULT;
    const now = new Date();
    const secondsSinceMidnight = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    const totalOffset = secondsSinceMidnight % totalLoopTime;

    const videoIndex = Math.floor(totalOffset / VIDEO_DURATION_DEFAULT);
    const startSeconds = totalOffset % VIDEO_DURATION_DEFAULT;
    const targetVideo = videos[videoIndex];

    setTimeout(() => {
        if (staticOverlay) staticOverlay.style.opacity = "0";
    }, 500); 

    if (!player) {
        player = new YT.Player('player', {
            videoId: targetVideo.id,
            playerVars: {
                'autoplay': 1, 'controls': 0, 'start': startSeconds,
                'mute': 1, 'playsinline': 1, 'modestbranding': 1,
                'rel': 0, 'disablekb': 1, 'iv_load_policy': 3
            },
            events: {
                'onReady': (event) => {
                    event.target.playVideo();
                    setTimeout(() => { event.target.unMute(); }, 1200);
                },
                'onStateChange': (event) => {
                    if (event.data === YT.PlayerState.ENDED) tuneToChannel(currentChannelIndex);
                },
                'onError': () => tuneToChannel(currentChannelIndex)
            }
        });
    } else {
        player.loadVideoById({
            videoId: targetVideo.id,
            startSeconds: startSeconds
        });
        setTimeout(() => { player.unMute(); }, 800);
    }
}

// 4. UI ELEMENTS
function showOSD(name, num) {
    const osd = document.getElementById('osd');
    if (!osd) return;
    const displayNum = num < 10 ? `0${num}` : num;
    osd.innerHTML = `CH ${displayNum}<br><span class="text-xl font-bold font-mono text-green-400">${name.toUpperCase()}</span>`;
    osd.classList.remove('hidden');
    if (window.osdTimeout) clearTimeout(window.osdTimeout);
    window.osdTimeout = setTimeout(() => osd.classList.add('hidden'), 3000);
}

// 5. INPUTS & DOM LISTENERS
// 5. INPUTS & DOM LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    const chanUpBtn = document.getElementById('chan-up');
    const chanDownBtn = document.getElementById('chan-down');
    const powerToggleBtn = document.getElementById('power-toggle');
    const staticAudio = document.getElementById('static-audio');

    const playStaticSound = () => {
        if (staticAudio) {
            staticAudio.volume = 0.15;
            staticAudio.currentTime = 0;
            staticAudio.play().catch(() => {});
            setTimeout(() => { staticAudio.pause(); }, 400);
        }
    };

    if (powerToggleBtn) {
        powerToggleBtn.addEventListener('click', () => {
            const playerDiv = document.getElementById('player');
            
            // Toggle the "Off" animation class
            const isOff = playerDiv.classList.contains('tv-off');
            
            if (isOff) {
                // ACTION: TURN ON
                playerDiv.classList.remove('tv-off');
                
                if (!player) {
                    // This is the first time pushing the button
                    console.log("Initial Power On: Starting App...");
                    initApp(); 
                } else {
                    // TV was just "standby", wake it up
                    player.playVideo();
                    setTimeout(() => { player.unMute(); }, 500);
                }
            } else {
                // ACTION: TURN OFF
                playerDiv.classList.add('tv-off');
                if (player) player.pauseVideo();
            }
        });
    }

    // Navigation (Only works if TV is ON)
    const navigate = (direction) => {
        const playerDiv = document.getElementById('player');
        if (playerDiv.classList.contains('tv-off')) return; // Don't change channels if off
        
        playStaticSound();
        if (direction === 'up') {
            tuneToChannel((currentChannelIndex + 1) % channels.length);
        } else {
            tuneToChannel((currentChannelIndex - 1 + channels.length) % channels.length);
        }
    };

    if (chanUpBtn) chanUpBtn.addEventListener('click', () => navigate('up'));
    if (chanDownBtn) chanDownBtn.addEventListener('click', () => navigate('down'));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') navigate('up');
        if (e.key === 'ArrowDown') navigate('down');
    });
});