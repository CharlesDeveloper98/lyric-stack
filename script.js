// ==========================================
// LyricSpot - Main Application Script
// ==========================================

// Global Audio Element and Active Tracking State
let activeAudioElement = null;
let currentPlayingTrackId = null;

// --- Hidden YouTube IFrame Audio Player Controller ---
let ytPlayer = null;
let ytPlayerReady = false;

// Inject YouTube IFrame API script dynamically if not present
if (!window.YT) {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
}

// Global callback required by YouTube IFrame API
window.onYouTubeIframeAPIReady = function() {
    let container = document.getElementById('hidden-yt-player-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'hidden-yt-player-container';
        container.style.cssText = 'position:absolute; width:0; height:0; overflow:hidden; opacity:0; pointer-events:none;';
        document.body.appendChild(container);
    }
    
    const playerDiv = document.createElement('div');
    playerDiv.id = 'yt-audio-player';
    container.appendChild(playerDiv);

    ytPlayer = new YT.Player('yt-audio-player', {
        height: '0',
        width: '0',
        playerVars: {
            'autoplay': 0,
            'controls': 0,
            'playsinline': 1
        },
        events: {
            'onReady': (event) => {
                ytPlayerReady = true;
            },
            'onStateChange': (event) => {
                // When song finishes playing (YT.PlayerState.ENDED is 0)
                if (event.data === 0) {
                    resetAllPlayButtons();
                }
            }
        }
    });
};

async function getYouTubeVideoId(artist, title) {
    const query = encodeURIComponent(`${artist} ${title} official audio`);
    try {
        const res = await fetch(`https://vid.puffyan.us/api/v1/search?q=${query}&type=video`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            return data[0].videoId;
        }
    } catch (e) {
        console.log("YouTube ID search fallback:", e);
    }
    return null;
}

function resetAllPlayButtons() {
    const activeImgs = document.querySelectorAll('.song-play-btn img, #immersive-play-icon');
    activeImgs.forEach(img => img.src = "assets/pause.png");
    currentPlayingTrackId = null;
}

// Dynamic Views Elements
const views = {
    home: document.getElementById('home-view'),
    search: document.getElementById('search-view'),
    settings: document.getElementById('settings-view')
};
const headerSubtitle = document.getElementById('header-subtitle');

// Navigation & Morphing Capsule Elements
const floatingTabBar = document.getElementById('floating-tab-bar');
const tabHome = document.getElementById('tab-home');
const tabSettings = document.getElementById('tab-settings');
const searchTriggerBtn = document.getElementById('search-trigger-btn');
const searchInputWrapper = document.getElementById('search-input-wrapper');
const searchInput = document.getElementById('search-input');
const micBtn = document.getElementById('mic-btn');

// Search & Lyrics Elements
const resultsSection = document.getElementById('results-section');
const resultsContent = document.getElementById('results-content');
const lyricsSection = document.getElementById('lyrics-section');
const lyricsContent = document.getElementById('lyrics-content');
const lyricsTitle = document.getElementById('lyrics-title');
const lyricsArtistTag = document.getElementById('lyrics-artist-tag');
const fullscreenLyricsBtn = document.getElementById('fullscreen-lyrics-btn');
const backToResultsBtn = document.getElementById('back-to-results-btn');

// --- Immersive Full-Screen Elements ---
const immersiveView = document.getElementById('immersive-fullscreen-view');
const immersiveBackBtn = document.getElementById('immersive-back-btn');
const immersiveArtwork = document.getElementById('immersive-artwork');
const immersiveArtworkVideo = document.getElementById('immersive-artwork-video');
const immersiveSongTitle = document.getElementById('immersive-song-title');
const immersiveArtistName = document.getElementById('immersive-artist-name');
const immersiveLyricsContent = document.getElementById('immersive-lyrics-content');
const immersivePlayBtn = document.getElementById('immersive-play-btn');
const immersivePlayIcon = document.getElementById('immersive-play-icon');

let searchTimeout = null;
let currentActiveArtworkUrl = ''; 
let currentActiveTrackData = null; // Stores current track info for sync

if (lyricsSection) {
    lyricsSection.classList.add('hidden');
}

// --- Dynamic Artwork Motion Toggle Logic with Persistence ---
const artworkMotionToggle = document.getElementById('artwork-motion-toggle');
const savedMotionState = localStorage.getItem('lyricspot_artwork_motion');

if (savedMotionState === 'enabled') {
    if (artworkMotionToggle) artworkMotionToggle.checked = true;
    if (immersiveView) immersiveView.classList.add('artwork-motion-active');
} else {
    if (artworkMotionToggle) artworkMotionToggle.checked = false;
    if (immersiveView) immersiveView.classList.remove('artwork-motion-active');
}

if (artworkMotionToggle && immersiveView) {
    artworkMotionToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            immersiveView.classList.add('artwork-motion-active');
            localStorage.setItem('lyricspot_artwork_motion', 'enabled');
        } else {
            immersiveView.classList.remove('artwork-motion-active');
            localStorage.setItem('lyricspot_artwork_motion', 'disabled');
        }
    });
}

// --- Animated Artwork Cover Toggle Logic with Persistence ---
const animatedCoverToggle = document.getElementById('animated-cover-toggle');
const savedAnimatedCoverState = localStorage.getItem('lyricspot_animated_cover');

if (savedAnimatedCoverState === 'enabled') {
    if (animatedCoverToggle) animatedCoverToggle.checked = true;
} else {
    if (animatedCoverToggle) animatedCoverToggle.checked = false;
}

if (animatedCoverToggle) {
    animatedCoverToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            localStorage.setItem('lyricspot_animated_cover', 'enabled');
        } else {
            localStorage.setItem('lyricspot_animated_cover', 'disabled');
        }
        
        if (immersiveView && !immersiveView.classList.contains('hidden') && currentActiveTrackData) {
            updateImmersiveCoverMedia(currentActiveTrackData.trackName, currentActiveTrackData.artistName, currentActiveArtworkUrl);
        }
    });
}

// Theme Elements
const themeButtons = document.querySelectorAll('.theme-btn');
const bodyElement = document.body;

// --- Navigation & Fluid Animation Handler ---
tabHome.addEventListener('click', () => {
    if (floatingTabBar.classList.contains('search-expanded')) {
        collapseSearchCapsule();
    }
    switchView('home');
});

tabSettings.addEventListener('click', () => {
    if (floatingTabBar.classList.contains('search-expanded')) {
        collapseSearchCapsule();
    }
    switchView('settings');
});

searchTriggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    expandSearchCapsule();
});

function expandSearchCapsule() {
    floatingTabBar.classList.add('search-expanded');
    searchInputWrapper.classList.remove('hidden');
    switchView('search');

    tabHome.classList.remove('active');
    tabSettings.classList.remove('active');
    searchTriggerBtn.classList.add('active');
}

function collapseSearchCapsule() {
    floatingTabBar.classList.remove('search-expanded');
    searchInputWrapper.classList.add('hidden');
    searchTriggerBtn.classList.remove('active');
    resultsSection.classList.add('hidden');
    lyricsSection.classList.add('hidden');
    searchInput.value = '';
    searchInput.blur();
}

function switchView(targetView) {
    if (targetView === 'home') {
        tabHome.classList.add('active');
        tabSettings.classList.remove('active');
        headerSubtitle.textContent = "Welcome to your personal music lyric hub";
    } else if (targetView === 'settings') {
        tabSettings.classList.add('active');
        tabHome.classList.remove('active');
        headerSubtitle.textContent = "Customize your Liquid Glass experience";
    } else if (targetView === 'search') {
        headerSubtitle.textContent = "Query global music catalogs instantly";
    }

    Object.keys(views).forEach(key => {
        if (views[key]) {
            if (key === targetView) {
                views[key].classList.remove('hidden');
            } else {
                views[key].classList.add('hidden');
            }
        }
    });
}

if (micBtn) {
    micBtn.addEventListener('click', () => {
        searchInput.focus();
    });
}

// --- Theme Switcher ---
function applyTheme(themeMode) {
    bodyElement.classList.remove('light-theme', 'dark-theme');
    
    if (themeMode === 'light') {
        bodyElement.classList.add('light-theme');
    } else if (themeMode === 'dark') {
        bodyElement.classList.add('dark-theme');
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            bodyElement.classList.add('dark-theme');
        } else {
            bodyElement.classList.add('light-theme');
        }
    }
}

themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        themeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const selectedTheme = btn.getAttribute('data-theme');
        applyTheme(selectedTheme);
    });
});

applyTheme('system');

// --- Search & Lyrics Logic ---
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length === 0) {
            resultsSection.classList.add('hidden');
            return;
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performMusicSearch(query);
        }, 400);
    });
}

if (backToResultsBtn) {
    backToResultsBtn.addEventListener('click', () => {
        lyricsSection.style.transform = 'translateX(40px)';
        lyricsSection.style.opacity = '0';

        setTimeout(() => {
            lyricsSection.classList.remove('fullscreen-mode');
            lyricsSection.classList.add('hidden');
            lyricsSection.style.transform = '';
            lyricsSection.style.opacity = '';

            resultsSection.classList.remove('hidden');
            resultsSection.style.transform = 'translateX(-30px)';
            resultsSection.style.opacity = '0';
            
            requestAnimationFrame(() => {
                resultsSection.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';
                resultsSection.style.transform = 'translateX(0)';
                resultsSection.style.opacity = '1';
            });
        }, 200);
    });
}

if (fullscreenLyricsBtn) {
    fullscreenLyricsBtn.addEventListener('click', () => {
        openImmersiveFullScreen();
    });
}

async function performMusicSearch(query) {
    resultsSection.classList.remove('hidden');
    resultsContent.innerHTML = `<p class="placeholder-text">Searching wide music catalogs...</p>`;

    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            renderSongList(data.results);
        } else {
            resultsContent.innerHTML = `<p class="placeholder-text">No tracks found matching "${query}"</p>`;
        }
    } catch (err) {
        resultsContent.innerHTML = `<p class="placeholder-text">Network connection error.</p>`;
    }
}

function cleanTitleForQuery(title) {
    return title
        .replace(/[\(\[].*?[\)\]]/g, '') 
        .replace(/[-–—]\s*(Single Version|Remix|Radio Edit|Acoustic|Live).*$/i, '')
        .trim();
}

async function getLyricsData(artist, title, durationMs = 0) {
    const cleanTitle = cleanTitleForQuery(title);
    const durationSec = durationMs ? Math.round(durationMs / 1000) : 0;

    if (durationSec) {
        try {
            const exactRes = await fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(artist)}&duration=${durationSec}`);
            if (exactRes.ok) {
                const exactData = await exactRes.json();
                if (exactData && exactData.plainLyrics && exactData.plainLyrics.length > 10) {
                    return exactData.plainLyrics;
                }
            }
        } catch (e) {}
    }

    try {
        const lrclibRes = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(artist)}`);
        const lrclibData = await lrclibRes.json();
        if (Array.isArray(lrclibData) && lrclibData.length > 0) {
            const match = lrclibData.find(item => item.plainLyrics && item.plainLyrics.length > 10);
            if (match) return match.plainLyrics;
        }
    } catch (e) {}

    try {
        const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
        const data = await res.json();
        if (data && data.lyrics && data.lyrics.length > 15) return data.lyrics;
    } catch (e) {}

    return null;
}

// --- Unified Full-Song Playback Controller (YouTube Embedded Player) ---
async function toggleTrackPlayback(track, playBtnImgElement) {
    if (currentPlayingTrackId === track.trackId && ytPlayer && ytPlayerReady) {
        const state = ytPlayer.getPlayerState();
        // 1 is PLAYING, 2 is PAUSED
        if (state === 1) {
            ytPlayer.pauseVideo();
            playBtnImgElement.src = "assets/pause.png";
            updateImmersivePlayIconState(false);
        } else {
            ytPlayer.playVideo();
            playBtnImgElement.src = "assets/playing.png";
            updateImmersivePlayIconState(true);
        }
    } else {
        if (activeAudioElement) {
            activeAudioElement.pause();
            activeAudioElement = null;
        }

        resetAllPlayButtons();
        currentPlayingTrackId = track.trackId;
        playBtnImgElement.src = "assets/playing.png";
        updateImmersivePlayIconState(true);

        const videoId = await getYouTubeVideoId(track.artistName, track.trackName);

        if (!videoId || !ytPlayer || !ytPlayerReady) {
            alert("Unable to fetch full stream for this song. Please check your internet connection.");
            resetAllPlayButtons();
            return;
        }

        // Load the full track starting from 0 seconds natively
        ytPlayer.loadVideoById({
            videoId: videoId,
            startSeconds: 0
        });
        ytPlayer.playVideo();
    }
}

function updateImmersivePlayIconState(isPlaying) {
    if (!immersivePlayIcon) return;
    immersivePlayIcon.src = isPlaying ? "assets/playing.png" : "assets/pause.png";
}

if (immersivePlayBtn) {
    immersivePlayBtn.addEventListener('click', () => {
        if (!currentActiveTrackData) return;
        const matchingRowBtnImg = document.querySelector(`.song-play-btn[data-track-id="${currentActiveTrackData.trackId}"] img`);
        if (matchingRowBtnImg) {
            toggleTrackPlayback(currentActiveTrackData, matchingRowBtnImg);
        } else {
            toggleTrackPlayback(currentActiveTrackData, immersivePlayIcon);
        }
    });
}

function renderSongList(tracks) {
    resultsContent.innerHTML = '';
    tracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'song-item';
        
        const artworkUrl = track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600';

        item.innerHTML = `
            <span class="availability-dot" id="dot-${index}" title="Checking..."></span>
            <img src="${artworkUrl}" class="song-thumb" alt="Art">
            <div class="song-meta" data-action="lyrics">
                <h4>${escapeHTML(track.trackName)}</h4>
                <p>${escapeHTML(track.artistName)}</p>
            </div>
            <button class="song-play-btn liquid-row-play-btn" data-track-id="${track.trackId}" title="Play / Pause">
                <img src="assets/pause.png" alt="Play State">
            </button>
        `;

        const playBtnComponent = item.querySelector('.song-play-btn');
        const playBtnImg = playBtnComponent.querySelector('img');

        playBtnComponent.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTrackPlayback(track, playBtnImg);
        });

        getLyricsData(track.artistName, track.trackName, track.trackTimeMillis).then(lyrics => {
            const dot = document.getElementById(`dot-${index}`);
            if (dot) {
                if (lyrics) {
                    dot.classList.add('available');
                    dot.title = "Lyrics available";
                } else {
                    dot.classList.add('unavailable');
                    dot.title = "Lyrics unavailable";
                }
            }
        });

        item.addEventListener('click', () => {
            currentActiveArtworkUrl = artworkUrl;
            currentActiveTrackData = track;

            resultsSection.style.transition = 'transform 0.3s ease, opacity 0.25s ease';
            resultsSection.style.transform = 'translateX(-40px)';
            resultsSection.style.opacity = '0';

            setTimeout(() => {
                resultsSection.classList.add('hidden');
                resultsSection.style.transform = '';
                resultsSection.style.opacity = '';
                fetchAndDisplayLyrics(track.artistName, track.trackName, track.trackTimeMillis);
            }, 250);
        });

        resultsContent.appendChild(item);
    });
}

// Attach listener to close full screen when back chevron is tapped
if (immersiveBackBtn) {
    immersiveBackBtn.addEventListener('click', () => {
        closeImmersiveFullScreen();
    });
}

// --- Open Immersive Full-Screen View ---
function openImmersiveFullScreen() {
    if (!immersiveView) return;

    const songTitleText = lyricsTitle.textContent;
    const artistNameText = lyricsArtistTag.textContent;

    immersiveSongTitle.textContent = songTitleText;
    immersiveArtistName.textContent = artistNameText;
    immersiveLyricsContent.innerHTML = lyricsContent.innerHTML;

    if (currentPlayingTrackId && ytPlayer && ytPlayerReady && ytPlayer.getPlayerState() === 1) {
        updateImmersivePlayIconState(true);
    } else {
        updateImmersivePlayIconState(false);
    }

    const isAnimatedEnabled = localStorage.getItem('lyricspot_animated_cover') === 'enabled';

    if (isAnimatedEnabled && currentActiveArtworkUrl) {
        updateImmersiveCoverMedia(songTitleText, artistNameText, currentActiveArtworkUrl);
    } else {
        if (immersiveArtwork) {
            immersiveArtwork.src = currentActiveArtworkUrl;
            immersiveArtwork.classList.remove('hidden');
        }
        if (immersiveArtworkVideo) {
            immersiveArtworkVideo.pause();
            immersiveArtworkVideo.src = '';
            immersiveArtworkVideo.classList.add('hidden');
        }
        if (immersiveView) {
            immersiveView.style.setProperty('--immersive-bg-image', `url('${currentActiveArtworkUrl}')`);
        }
    }

    if (localStorage.getItem('lyricspot_artwork_motion') === 'enabled') {
        immersiveView.classList.add('artwork-motion-active');
    } else {
        immersiveView.classList.remove('artwork-motion-active');
    }

    immersiveView.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// --- Dynamic Apple Music Animated Artwork Video Fetcher ---
async function updateImmersiveCoverMedia(title, artist, defaultArtworkUrl) {
    if (!immersiveArtworkVideo || !immersiveArtwork) return;

    immersiveArtwork.src = defaultArtworkUrl;
    if (immersiveView) immersiveView.style.setProperty('--immersive-bg-image', `url('${defaultArtworkUrl}')`);

    try {
        const query = encodeURIComponent(`${title} ${artist}`);
        const response = await fetch(`https://itunes.apple.com/search?term=${query}&entity=musicTrack&limit=1`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const trackData = data.results[0];
            
            if (trackData.previewUrl) {
                immersiveArtworkVideo.src = trackData.previewUrl;
                immersiveArtworkVideo.load();
                immersiveArtworkVideo.loop = true;
                immersiveArtworkVideo.muted = true;
                immersiveArtworkVideo.playsInline = true;
                
                await immersiveArtworkVideo.play();
                
                immersiveArtworkVideo.classList.remove('hidden');
                immersiveArtwork.classList.add('hidden');
                return;
            }
        }
    } catch (error) {
        console.log("Animated cover fetch warning:", error);
    }

    immersiveArtworkVideo.src = 'https://assets.mixkit.co/videos/preview/mixkit-clouds-and-blue-sky-2408-large.mp4';
    immersiveArtworkVideo.load();
    immersiveArtworkVideo.loop = true;
    immersiveArtworkVideo.muted = true;
    immersiveArtworkVideo.playsInline = true;
    
    try {
        await immersiveArtworkVideo.play();
        immersiveArtworkVideo.classList.remove('hidden');
        immersiveArtwork.classList.add('hidden');
    } catch (e) {
        immersiveArtworkVideo.classList.add('hidden');
        immersiveArtwork.classList.remove('hidden');
    }
}

function closeImmersiveFullScreen() {
    if (!immersiveView) return;
    immersiveView.classList.add('hidden');
    if (immersiveArtworkVideo) {
        immersiveArtworkVideo.pause();
        immersiveArtworkVideo.src = '';
    }
    document.body.style.overflow = '';
}

async function fetchAndDisplayLyrics(artist, title, durationMs) {
    lyricsSection.classList.remove('hidden');
    lyricsSection.style.transform = 'translateX(40px)';
    lyricsSection.style.opacity = '0';

    requestAnimationFrame(() => {
        lyricsSection.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';
        lyricsSection.style.transform = 'translateX(0)';
        lyricsSection.style.opacity = '1';
    });

    lyricsSection.classList.remove('fullscreen-mode');
    fullscreenLyricsBtn.textContent = "See full lyrics...";
    lyricsTitle.textContent = title;
    lyricsArtistTag.textContent = artist;
    lyricsContent.innerHTML = `<p class="placeholder-text">Fetching lyrics for "${title}"...</p>`;

    const lyrics = await getLyricsData(artist, title, durationMs);

    if (lyrics) {
        lyricsContent.textContent = lyrics;
    } else {
        lyricsContent.innerHTML = `<p class="placeholder-text">Lyrics unavailable for <b>${title}</b> across public catalogs.</p>`;
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// --- Dynamic Ambient Mesh Toggle Logic with Persistence ---
const ambientMeshToggle = document.getElementById('ambient-mesh-toggle');
const meshBgElement = document.querySelector('.mesh-bg');

const savedMeshState = localStorage.getItem('lyricspot_ambient_mesh');

if (savedMeshState === 'enabled') {
    if (ambientMeshToggle) ambientMeshToggle.checked = true;
    if (meshBgElement) meshBgElement.classList.add('mesh-animated');
} else {
    if (ambientMeshToggle) ambientMeshToggle.checked = false;
    if (meshBgElement) meshBgElement.classList.remove('mesh-animated');
}

if (ambientMeshToggle && meshBgElement) {
    ambientMeshToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            meshBgElement.classList.add('mesh-animated');
            localStorage.setItem('lyricspot_ambient_mesh', 'enabled');
        } else {
            meshBgElement.classList.remove('mesh-animated');
            localStorage.setItem('lyricspot_ambient_mesh', 'disabled');
        }
    });
}
