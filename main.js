const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
let player = null;
let channels = [];
let currentChannelIndex = 0;
const VIDEO_DURATION_DEFAULT = 600; 

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

async function getChannelVideos(youtubeId) {
    const storageKey = `cache_${youtubeId}`;
    const cachedData = localStorage.getItem(storageKey);
    
    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const age = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
        if (age < 12) return parsed.videos;
    }

    try {
        // videoDuration=medium filters for 4-20 minute videos (Removes Shorts)
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${youtubeId}&part=snippet,id&order=date&maxResults=15&type=video&videoDuration=medium`
        );
        const data = await response.json();
        
        if (!data.items) throw new Error("API returned no items");

        const videos = data.items
            .filter(item => {
                const title = item.snippet.title.toLowerCase();
                // Double protection: Block anything with "shorts" in the title
                return !title.includes('shorts') && !title.includes('#short');
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
                'autoplay': 1,
                'controls': 0,
                'start': startSeconds,
                'mute': 1,
                'playsinline': 1,
                'modestbranding': 1,
                'rel': 0,
                'disablekb': 1,
                'iv_load_policy': 3
            },
            events: {
                'onReady': (event) => {
                    event.target.playVideo();
                    setTimeout(() => { event.target.unMute(); }, 1200);
                },
                'onStateChange': (event) => {
                    if (event.data === YT.PlayerState.ENDED) {
                        tuneToChannel(currentChannelIndex);
                    }
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

function showOSD(name, num) {
    const osd = document.getElementById('osd');
    if (!osd) return;
    const displayNum = num < 10 ? `0${num}` : num;
    osd.innerHTML = `CH ${displayNum}<br><span class="text-xl font-bold">${name.toUpperCase()}</span>`;
    osd.classList.remove('hidden');
    if (window.osdTimeout) clearTimeout(window.osdTimeout);
    window.osdTimeout = setTimeout(() => osd.classList.add('hidden'), 3000);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') tuneToChannel((currentChannelIndex + 1) % channels.length);
    if (e.key === 'ArrowDown') tuneToChannel((currentChannelIndex - 1 + channels.length) % channels.length);
});

document.addEventListener('DOMContentLoaded', () => {
    const powerBtn = document.getElementById('power-btn');
    if (powerBtn) {
        powerBtn.addEventListener('click', () => {
            document.getElementById('power-on-screen').classList.add('hidden');
            initApp(); 
        });
    } else {
        initApp();
    }
});

// In main.js, update the click listener:
powerBtn.addEventListener('click', () => {
    document.getElementById('power-on-screen').classList.add('hidden');
    
    // If player exists, force it to play and unmute now
    if (player && player.playVideo) {
        player.playVideo();
        setTimeout(() => {
            player.unMute();
            player.setVolume(50);
        }, 500);
    } else {
        initApp(); // Fallback if not ready
    }
});