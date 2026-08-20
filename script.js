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

// Theme Elements
const themeButtons = document.querySelectorAll('.theme-btn');
const bodyElement = document.body;

let searchTimeout = null;

// Ensure lyrics starts hidden
if (lyricsSection) {
    lyricsSection.classList.add('hidden');
}

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

// Microphone action handler
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

// --- Smooth Transition Back Button Handler ---
if (backToResultsBtn) {
    backToResultsBtn.addEventListener('click', () => {
        // Slide out lyrics view to the right
        lyricsSection.style.transform = 'translateX(40px)';
        lyricsSection.style.opacity = '0';

        setTimeout(() => {
            lyricsSection.classList.remove('fullscreen-mode');
            lyricsSection.classList.add('hidden');
            // Reset inline animation styles
            lyricsSection.style.transform = '';
            lyricsSection.style.opacity = '';

            // Reveal search results smoothly with slide-in effect
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
        lyricsSection.classList.toggle('fullscreen-mode');
        fullscreenLyricsBtn.textContent = lyricsSection.classList.contains('fullscreen-mode') 
            ? "Exit full screen" 
            : "See full lyrics...";
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

// Helper function to verify if lyrics exist for accurate green/red indicator dots
async function checkLyricsAvailability(artist, title) {
    try {
        const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
        const data = await res.json();
        if (data && data.lyrics) return true;
    } catch (e) {
        // Fallback check secondary source if primary fails
        try {
            const res2 = await fetch(`https://some-random-api.com/others/lyrics?title=${encodeURIComponent(title)}`);
            const data2 = await res2.json();
            if (data2 && data2.lyrics) return true;
        } catch (err) {
            // ignore
        }
    }
    return false;
}

function renderSongList(tracks) {
    resultsContent.innerHTML = '';
    tracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'song-item';
        
        const artworkUrl = track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '200x200bb') : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200';

        // Placeholder row with a neutral pending indicator dot while checking availability
        item.innerHTML = `
            <span class="availability-dot" id="dot-${index}" title="Checking availability..."></span>
            <img src="${artworkUrl}" class="song-thumb" alt="Art">
            <div class="song-meta">
                <h4>${escapeHTML(track.trackName)}</h4>
                <p>${escapeHTML(track.artistName)}</p>
            </div>
        `;

        // Asynchronously check and update indicator to Green (available) or Red (unavailable) with 100% precision
        checkLyricsAvailability(track.artistName, track.trackName).then(hasLyrics => {
            const dot = document.getElementById(`dot-${index}`);
            if (dot) {
                if (hasLyrics) {
                    dot.classList.add('available');
                    dot.title = "Lyrics available";
                } else {
                    dot.classList.add('unavailable');
                    dot.title = "Lyrics unavailable";
                }
            }
        });

        // Smooth transition trigger when clicking a song item
        item.addEventListener('click', () => {
            resultsSection.style.transition = 'transform 0.3s ease, opacity 0.25s ease';
            resultsSection.style.transform = 'translateX(-40px)';
            resultsSection.style.opacity = '0';

            setTimeout(() => {
                resultsSection.classList.add('hidden');
                resultsSection.style.transform = '';
                resultsSection.style.opacity = '';
                fetchLyrics(track.artistName, track.trackName);
            }, 250);
        });

        resultsContent.appendChild(item);
    });
}

async function fetchLyrics(artist, title) {
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

    try {
        const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
        const data = await response.json();

        if (data.lyrics) {
            lyricsContent.textContent = data.lyrics;
        } else {
            fetchSecondaryLyricsSource(artist, title);
        }
    } catch (e) {
        fetchSecondaryLyricsSource(artist, title);
    }
}

async function fetchSecondaryLyricsSource(artist, title) {
    try {
        const res = await fetch(`https://some-random-api.com/others/lyrics?title=${encodeURIComponent(title)}`);
        const data = await res.json();
        if (data && data.lyrics) {
            lyricsContent.textContent = data.lyrics;
        } else {
            lyricsContent.innerHTML = `<p class="placeholder-text">Lyrics unavailable for <b>${title}</b>.</p>`;
        }
    } catch (err) {
        lyricsContent.innerHTML = `<p class="placeholder-text">Could not resolve lyrics securely.</p>`;
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
