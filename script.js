// ==========================================
// LyricSpot - Main Application Script
// ==========================================

let activeAudioElement = null;
let currentPlayingTrackId = null;

// --- Hidden YouTube IFrame Audio Player Controller ---
let ytPlayer = null;
let ytPlayerReady = false;

if (!window.YT) {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
}

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
        playerVars: { 'autoplay': 0, 'controls': 0, 'playsinline': 1 },
        events: {
            'onReady': () => { ytPlayerReady = true; },
            'onStateChange': (event) => {
                if (event.data === 0) { resetAllPlayButtons(); }
            }
        }
    });
};

async function getFullSongAudioStreamUrl(artist, title) {
    const cleanTitleText = cleanTitleForQuery(title);
    const query = encodeURIComponent(`${artist} ${cleanTitleText} official audio full track`);
    const pipedInstances = [
        "https://pipedapi.kavin.rocks",
        "https://pipedapi.privacy.com.de",
        "https://api.piped.privacydev.net"
    ];

    for (const instance of pipedInstances) {
        try {
            const searchRes = await fetch(`${instance}/search?q=${query}&filter=videos`, { signal: AbortSignal.timeout(4000) });
            const searchData = await searchRes.json();
            
            if (searchData && searchData.items && searchData.items.length > 0) {
                for (let i = 0; i < Math.min(searchData.items.length, 3); i++) {
                    const videoId = searchData.items[i].url.split('/watch?v=')[1];
                    if (videoId) {
                        const streamRes = await fetch(`${instance}/streams/${videoId}`, { signal: AbortSignal.timeout(4000) });
                        const streamData = await streamRes.json();
                        
                        if (streamData && streamData.audioStreams && streamData.audioStreams.length > 0) {
                            const audioStreams = streamData.audioStreams.filter(s => s.url);
                            audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                            if (audioStreams.length > 0) return audioStreams[0].url;
                        }
                    }
                }
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

function resetAllPlayButtons() {
    const activeImgs = document.querySelectorAll('.song-play-btn img, #immersive-play-icon');
    activeImgs.forEach(img => img.src = "assets/pause.png");
    currentPlayingTrackId = null;
    if (activeAudioElement) {
        activeAudioElement.pause();
        activeAudioElement = null;
    }
}

// Dynamic Views Elements
const views = {
    home: document.getElementById('home-view'),
    search: document.getElementById('search-view'),
    settings: document.getElementById('settings-view')
};
const headerSubtitle = document.getElementById('header-subtitle');

const floatingTabBar = document.getElementById('floating-tab-bar');
const tabHome = document.getElementById('tab-home');
const tabSettings = document.getElementById('tab-settings');
const searchTriggerBtn = document.getElementById('search-trigger-btn');
const searchInputWrapper = document.getElementById('search-input-wrapper');
const searchInput = document.getElementById('search-input');
const micBtn = document.getElementById('mic-btn');

const resultsSection = document.getElementById('results-section');
const resultsContent = document.getElementById('results-content');
const lyricsSection = document.getElementById('lyrics-section');
const lyricsContent = document.getElementById('lyrics-content');
const lyricsTitle = document.getElementById('lyrics-title');
const lyricsArtistTag = document.getElementById('lyrics-artist-tag');
const fullscreenLyricsBtn = document.getElementById('fullscreen-lyrics-btn');
const backToResultsBtn = document.getElementById('back-to-results-btn');

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
let currentActiveTrackData = null;

if (lyricsSection) lyricsSection.classList.add('hidden');

// --- Toggles Persistence ---
const artworkMotionToggle = document.getElementById('artwork-motion-toggle');
if (localStorage.getItem('lyricspot_artwork_motion') === 'enabled') {
    if (artworkMotionToggle) artworkMotionToggle.checked = true;
    if (immersiveView) immersiveView.classList.add('artwork-motion-active');
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

const animatedCoverToggle = document.getElementById('animated-cover-toggle');
if (localStorage.getItem('lyricspot_animated_cover') === 'enabled') {
    if (animatedCoverToggle) animatedCoverToggle.checked = true;
}

if (animatedCoverToggle) {
    animatedCoverToggle.addEventListener('change', (e) => {
        localStorage.setItem('lyricspot_animated_cover', e.target.checked ? 'enabled' : 'disabled');
        if (immersiveView && !immersiveView.classList.contains('hidden') && currentActiveTrackData) {
            prepareAndOpenImmersiveView(currentActiveTrackData.trackName, currentActiveTrackData.artistName, currentActiveArtworkUrl);
        }
    });
}

// Navigation Handlers
tabHome.addEventListener('click', () => {
    if (floatingTabBar.classList.contains('search-expanded')) collapseSearchCapsule();
    switchView('home');
});

tabSettings.addEventListener('click', () => {
    if (floatingTabBar.classList.contains('search-expanded')) collapseSearchCapsule();
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
            views[key].classList.toggle('hidden', key !== targetView);
        }
    });
}

// Search Logic
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length === 0) {
            resultsSection.classList.add('hidden');
            return;
        }
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performMusicSearch(query), 400);
    });
}

if (backToResultsBtn) {
    backToResultsBtn.addEventListener('click', () => {
        lyricsSection.style.transform = 'translateX(40px)';
        lyricsSection.style.opacity = '0';
        setTimeout(() => {
            lyricsSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');
            resultsSection.style.transform = 'translateX(0)';
            resultsSection.style.opacity = '1';
        }, 200);
    });
}

if (fullscreenLyricsBtn) {
    fullscreenLyricsBtn.addEventListener('click', () => openImmersiveFullScreen());
}

async function performMusicSearch(query) {
    resultsSection.classList.remove('hidden');
    resultsContent.innerHTML = `<p class="placeholder-text">Searching catalogs...</p>`;
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            renderSongList(data.results);
        } else {
            resultsContent.innerHTML = `<p class="placeholder-text">No tracks found.</p>`;
        }
    } catch (err) {
        resultsContent.innerHTML = `<p class="placeholder-text">Network connection error.</p>`;
    }
}

function cleanTitleForQuery(title) {
    return title.replace(/[\(\[].*?[\)\]]/g, '').replace(/[-–—]\s*(Single Version|Remix|Radio Edit|Acoustic|Live).*$/i, '').trim();
}

async function getLyricsData(artist, title, durationMs = 0) {
    const cleanTitle = cleanTitleForQuery(title);
    const durationSec = durationMs ? Math.round(durationMs / 1000) : 0;
    try {
        const res = await fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(artist)}&duration=${durationSec}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.plainLyrics) return data.plainLyrics;
        }
    } catch (e) {}
    return null;
}

async function toggleTrackPlayback(track, playBtnImgElement) {
    if (currentPlayingTrackId === track.trackId && activeAudioElement) {
        if (activeAudioElement.paused) {
            activeAudioElement.play();
            playBtnImgElement.src = "assets/playing.png";
            updateImmersivePlayIconState(true);
        } else {
            activeAudioElement.pause();
            playBtnImgElement.src = "assets/pause.png";
            updateImmersivePlayIconState(false);
        }
        return;
    }

    if (activeAudioElement) {
        activeAudioElement.pause();
        activeAudioElement = null;
    }

    resetAllPlayButtons();
    currentPlayingTrackId = track.trackId;
    playBtnImgElement.src = "assets/playing.png";
    updateImmersivePlayIconState(true);

    const fullAudioUrl = await getFullSongAudioStreamUrl(track.artistName, track.trackName);
    const targetUrl = fullAudioUrl || track.previewUrl;

    if (targetUrl) {
        activeAudioElement = new Audio(targetUrl);
        activeAudioElement.play().catch(() => resetAllPlayButtons());
        activeAudioElement.addEventListener('ended', () => resetAllPlayButtons());
    } else {
        resetAllPlayButtons();
    }
}

function updateImmersivePlayIconState(isPlaying) {
    if (immersivePlayIcon) immersivePlayIcon.src = isPlaying ? "assets/playing.png" : "assets/pause.png";
}

if (immersivePlayBtn) {
    immersivePlayBtn.addEventListener('click', () => {
        if (!currentActiveTrackData) return;
        const matchingBtn = document.querySelector(`.song-play-btn[data-track-id="${currentActiveTrackData.trackId}"] img`);
        toggleTrackPlayback(currentActiveTrackData, matchingBtn || immersivePlayIcon);
    });
}

function renderSongList(tracks) {
    resultsContent.innerHTML = '';
    tracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'song-item';
        const artworkUrl = track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : '';

        item.innerHTML = `
            <span class="availability-dot" id="dot-${index}"></span>
            <img src="${artworkUrl}" class="song-thumb" alt="Art">
            <div class="song-meta">
                <h4>${escapeHTML(track.trackName)}</h4>
                <p>${escapeHTML(track.artistName)}</p>
            </div>
            <button class="song-play-btn" data-track-id="${track.trackId}">
                <img src="assets/pause.png" alt="Play">
            </button>
        `;

        const playBtnComponent = item.querySelector('.song-play-btn');
        const playBtnImg = playBtnComponent.querySelector('img');

        playBtnComponent.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTrackPlayback(track, playBtnImg);
        });

        item.addEventListener('click', () => {
            currentActiveArtworkUrl = artworkUrl;
            currentActiveTrackData = track;
            resultsSection.classList.add('hidden');
            fetchAndDisplayLyrics(track.artistName, track.trackName, track.trackTimeMillis);
        });

        resultsContent.appendChild(item);
    });
}

if (immersiveBackBtn) {
    immersiveBackBtn.addEventListener('click', () => immersiveView.classList.add('hidden'));
}

async function openImmersiveFullScreen() {
    if (!immersiveView) return;
    immersiveSongTitle.textContent = lyricsTitle.textContent;
    immersiveArtistName.textContent = lyricsArtistTag.textContent;
    immersiveLyricsContent.innerHTML = lyricsContent.innerHTML;

    updateImmersivePlayIconState(activeAudioElement && !activeAudioElement.paused);
    await prepareAndOpenImmersiveView(lyricsTitle.textContent, lyricsArtistTag.textContent, currentActiveArtworkUrl);

    immersiveView.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// --- Precise Cover Resolver (Unblurred Music Picture with Motion & Dim/Bright Effect) ---
async function prepareAndOpenImmersiveView(title, artist, defaultArtworkUrl) {
    if (!immersiveArtworkVideo || !immersiveArtwork) return;

    const isAnimatedEnabled = localStorage.getItem('lyricspot_animated_cover') === 'enabled';
    immersiveView.style.removeProperty('--immersive-bg-image');

    if (!isAnimatedEnabled) {
        immersiveArtwork.src = defaultArtworkUrl;
        immersiveArtwork.classList.remove('hidden', 'static-picture-animated');
        immersiveArtworkVideo.pause();
        immersiveArtworkVideo.classList.add('hidden');
        return;
    }

    let resolvedVideoUrl = null;
    try {
        const queryTerm = encodeURIComponent(`${cleanTitleForQuery(title)} ${artist}`);
        const mvRes = await fetch(`https://itunes.apple.com/search?term=${queryTerm}&entity=musicVideo&limit=1`);
        const mvData = await mvRes.json();
        if (mvData.results?.[0]?.previewUrl) {
            resolvedVideoUrl = mvData.results[0].previewUrl;
        }
    } catch (e) {}

    // If no video exists, use the clear music picture with smooth floating motion, brightness, and dimming
    if (!resolvedVideoUrl) {
        immersiveArtworkVideo.pause();
        immersiveArtworkVideo.removeAttribute('src');
        immersiveArtworkVideo.classList.add('hidden');

        immersiveArtwork.src = defaultArtworkUrl;
        immersiveArtwork.classList.add('static-picture-animated');
        immersiveArtwork.classList.remove('hidden');
        return;
    }

    // Play video stream if available
    try {
        immersiveArtworkVideo.src = resolvedVideoUrl;
        immersiveArtworkVideo.load();
        immersiveArtworkVideo.loop = true;
        immersiveArtworkVideo.muted = true;
        immersiveArtworkVideo.playsInline = true;
        await immersiveArtworkVideo.play();
        immersiveArtworkVideo.classList.remove('hidden');
        immersiveArtwork.classList.add('hidden');
    } catch (err) {
        immersiveArtworkVideo.pause();
        immersiveArtwork.src = defaultArtworkUrl;
        immersiveArtwork.classList.add('static-picture-animated');
        immersiveArtwork.classList.remove('hidden');
    }
}

async function fetchAndDisplayLyrics(artist, title, durationMs) {
    lyricsSection.classList.remove('hidden');
    lyricsTitle.textContent = title;
    lyricsArtistTag.textContent = artist;
    lyricsContent.innerHTML = `<p class="placeholder-text">Loading lyrics...</p>`;

    const lyrics = await getLyricsData(artist, title, durationMs);
    lyricsContent.textContent = lyrics || "Lyrics unavailable.";
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
