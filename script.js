const views = {
    home: document.getElementById('home-view'),
    search: document.getElementById('search-view'),
    settings: document.getElementById('settings-view')
};
const headerSubtitle = document.getElementById('header-subtitle');

const floatingTabBar = document.getElementById('floating-tab-bar');
const homeTabBtn = document.getElementById('home-tab-btn');
const settingsTabBtn = document.getElementById('settings-tab-btn');

const searchTriggerBtn = document.getElementById('search-trigger-btn');
const searchInputWrapper = document.getElementById('search-input-wrapper');
const searchInput = document.getElementById('search-input');
const micBtn = document.getElementById('mic-btn');
const closeSearchBtn = document.getElementById('close-search-btn');

const resultsSection = document.getElementById('results-section');
const resultsContent = document.getElementById('results-content');
const lyricsSection = document.getElementById('lyrics-section');
const lyricsContent = document.getElementById('lyrics-content');
const lyricsTitle = document.getElementById('lyrics-title');
const lyricsArtistTag = document.getElementById('lyrics-artist-tag');
const closeLyricsBtn = document.getElementById('close-lyrics');
const fullscreenLyricsBtn = document.getElementById('fullscreen-lyrics-btn');

const themeButtons = document.querySelectorAll('.theme-btn');
const bodyElement = document.body;

let searchTimeout = null;
lyricsSection.classList.add('hidden');

homeTabBtn.addEventListener('click', () => {
    if (floatingTabBar.classList.contains('search-expanded')) {
        collapseSearchCapsule();
    }
    switchTab('home');
});

settingsTabBtn.addEventListener('click', () => {
    if (floatingTabBar.classList.contains('search-expanded')) {
        collapseSearchCapsule();
    }
    switchTab('settings');
});

function switchTab(target) {
    homeTabBtn.classList.remove('active');
    settingsTabBtn.classList.remove('active');

    if (target === 'home') {
        homeTabBtn.classList.add('active');
        switchView('home');
    } else if (target === 'settings') {
        settingsTabBtn.classList.add('active');
        switchView('settings');
    }
}

searchTriggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    expandSearchBar();
});

searchInput.addEventListener('click', (e) => {
    e.stopPropagation();
});

function expandSearchBar() {
    floatingTabBar.classList.add('search-expanded');
    searchInputWrapper.classList.remove('hidden');
    closeSearchBtn.classList.remove('hidden');
    switchView('search');
    searchTriggerBtn.classList.add('active');

    // Left capsule shows ONLY Settings
    homeTabBtn.classList.remove('active');
    settingsTabBtn.classList.add('active');
    searchInput.focus();
}

closeSearchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    collapseSearchCapsule();
});

function collapseSearchCapsule() {
    floatingTabBar.classList.remove('search-expanded');
    searchInputWrapper.classList.add('hidden');
    closeSearchBtn.classList.add('hidden');
    searchTriggerBtn.classList.remove('active');
    resultsSection.classList.add('hidden');
    lyricsSection.classList.add('hidden');
    searchInput.value = '';
    searchInput.blur();
    
    switchTab('home');
}

function switchView(targetView) {
    if (targetView === 'home') {
        headerSubtitle.textContent = "Query global music catalogs instantly";
    } else if (targetView === 'settings') {
        headerSubtitle.textContent = "Customize your Liquid Glass experience";
    } else if (targetView === 'search') {
        headerSubtitle.textContent = "Query global music catalogs instantly";
    }

    Object.keys(views).forEach(key => {
        if (key === targetView) {
            views[key].classList.remove('hidden');
        } else {
            views[key].classList.add('hidden');
        }
    });
}

if (micBtn) {
    micBtn.addEventListener('click', () => {
        searchInput.focus();
    });
}

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
        applyTheme(btn.getAttribute('data-theme'));
    });
});

applyTheme('system');

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

closeLyricsBtn.addEventListener('click', () => {
    lyricsSection.classList.remove('fullscreen-mode');
    lyricsSection.classList.add('hidden');
});

fullscreenLyricsBtn.addEventListener('click', () => {
    lyricsSection.classList.toggle('fullscreen-mode');
    fullscreenLyricsBtn.textContent = lyricsSection.classList.contains('fullscreen-mode') 
        ? "Exit full screen" 
        : "See full lyrics...";
});

async function performMusicSearch(query) {
    resultsSection.classList.remove('hidden');
    resultsContent.innerHTML = `<p class="placeholder-text">Searching wide music catalogs...</p>`;

    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25`);
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

function renderSongList(tracks) {
    resultsContent.innerHTML = '';
    tracks.forEach(track => {
        const item = document.createElement('div');
        item.className = 'song-item';
        
        const artworkUrl = track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '200x200bb') : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200';

        item.innerHTML = `
            <img src="${artworkUrl}" class="song-thumb" alt="Art">
            <div class="song-meta">
                <h4>${escapeHTML(track.trackName)}</h4>
                <p>${escapeHTML(track.artistName)}</p>
            </div>
        `;

        item.addEventListener('click', () => {
            fetchLyrics(track.artistName, track.trackName);
        });

        resultsContent.appendChild(item);
    });
}

async function fetchLyrics(artist, title) {
    resultsSection.classList.add('hidden');
    lyricsSection.classList.remove('fullscreen-mode');
    fullscreenLyricsBtn.textContent = "See full lyrics...";
    lyricsSection.classList.remove('hidden');
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
