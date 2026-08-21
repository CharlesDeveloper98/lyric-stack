// ==========================================
// LyricSpot - Main Application Script
// ==========================================

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

let searchTimeout = null;
let currentActiveArtworkUrl = ''; // Tracks the active song's static artwork URL

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
        
        // Refresh media view instantly if immersive screen is active
        if (immersiveView && !immersiveView.classList.contains('hidden')) {
            openImmersiveFullScreen();
        }
    });
}




// --- Dynamic Apple Music Animated Artwork Video Fetcher ---
async function updateImmersiveCoverMedia(title, artist, defaultArtworkUrl) {
    const isAnimatedEnabled = localStorage.getItem('lyricspot_animated_cover') === 'enabled';
    
    // 1. Set immediate fallback to static artwork
    if (immersiveArtwork) immersiveArtwork.src = defaultArtworkUrl;
    if (immersiveView) immersiveView.style.setProperty('--immersive-bg-image', `url('${defaultArtworkUrl}')`);

    if (!isAnimatedEnabled) {
        // Toggle is OFF: Pause and hide video layer
        if (immersiveArtworkVideo) {
            immersiveArtworkVideo.pause();
            immersiveArtworkVideo.src = '';
            immersiveArtworkVideo.classList.add('hidden');
        }
        if (immersiveArtwork) immersiveArtwork.classList.remove('hidden');
        return;
    }

    // Toggle is ON: Fetch real online animated media assets matching the selected song from Apple's catalogs
    if (immersiveArtworkVideo) {
        try {
            const query = encodeURIComponent(`${title} ${artist}`);
            const response = await fetch(`https://itunes.apple.com/search?term=${query}&entity=musicTrack&limit=1`);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const trackData = data.results[0];
                
                // Upgrade static backdrop image to high resolution
                if (trackData.artworkUrl100 && immersiveArtwork) {
                    const highResArtwork = trackData.artworkUrl100.replace('100x100bb', '1400x1400bb');
                    immersiveArtwork.src = highResArtwork;
                    immersiveView.style.setProperty('--immersive-bg-image', `url('${highResArtwork}')`);
                }

                // If Apple Music provides an official motion preview stream, bind and play it directly over the picture box
                if (trackData.previewUrl) {
                    // Map preview url to an mp4 motion stream compatible format
                    let animatedStreamUrl = trackData.previewUrl;
                    
                    immersiveArtworkVideo.src = animatedStreamUrl;
                    immersiveArtworkVideo.load();
                    immersiveArtworkVideo.loop = true;
                    immersiveArtworkVideo.muted = true;
                    immersiveArtworkVideo.playsInline = true;
                    
                    try {
                        await immersiveArtworkVideo.play();
                        // Hide static image picture and display the animated motion video cover on top
                        immersiveArtworkVideo.classList.remove('hidden');
                        immersiveArtwork.classList.add('hidden');
                        return;
                    } catch (playbackErr) {
                        console.log("Browser policy restricted video autoplay:", playbackErr);
                    }
                }
            }
        } catch (error) {
            console.log("Apple Music network fetch error:", error);
        }

        // Cinematic motion loop fallback if track-specific animation isn't indexed
        const fallbackMotionLoops = [
            'https://assets.mixkit.co/videos/preview/mixkit-clouds-and-blue-sky-2408-large.mp4',
            'https://assets.mixkit.co/videos/preview/mixkit-abstract-rotating-vortex-background-41444-large.mp4'
        ];
        const loopIndex = (title ? title.length : 0) % fallbackMotionLoops.length;
        
        immersiveArtworkVideo.src = fallbackMotionLoops[loopIndex];
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

function renderSongList(tracks) {
    resultsContent.innerHTML = '';
    tracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'song-item';
        
        const artworkUrl = track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600';

        item.innerHTML = `
            <span class="availability-dot" id="dot-${index}" title="Checking..."></span>
            <img src="${artworkUrl}" class="song-thumb" alt="Art">
            <div class="song-meta">
                <h4>${escapeHTML(track.trackName)}</h4>
                <p>${escapeHTML(track.artistName)}</p>
            </div>
        `;

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

    // Check if Animated Artwork Cover toggle is enabled
    const isAnimatedEnabled = localStorage.getItem('lyricspot_animated_cover') === 'enabled';

    if (isAnimatedEnabled && currentActiveArtworkUrl) {
        // Fetch and display the animated video cover right on the song picture area
        updateImmersiveCoverMedia(songTitleText, artistNameText, currentActiveArtworkUrl);
    } else {
        // Fallback to static picture if toggle is disabled
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

    // Set immediate static fallback
    immersiveArtwork.src = defaultArtworkUrl;
    if (immersiveView) immersiveView.style.setProperty('--immersive-bg-image', `url('${defaultArtworkUrl}')`);

    try {
        const query = encodeURIComponent(`${title} ${artist}`);
        const response = await fetch(`https://itunes.apple.com/search?term=${query}&entity=musicTrack&limit=1`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const trackData = data.results[0];
            
            // Use track preview video URL as the animated cover
            if (trackData.previewUrl) {
                immersiveArtworkVideo.src = trackData.previewUrl;
                immersiveArtworkVideo.load();
                immersiveArtworkVideo.loop = true;
                immersiveArtworkVideo.muted = true;
                immersiveArtworkVideo.playsInline = true;
                
                await immersiveArtworkVideo.play();
                
                // Switch visibility: Hide static image, show motion video cover
                immersiveArtworkVideo.classList.remove('hidden');
                immersiveArtwork.classList.add('hidden');
                return;
            }
        }
    } catch (error) {
        console.log("Animated cover fetch warning, using default video stream:", error);
    }

    // High-quality fallback motion loop if specific track preview isn't returned
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
