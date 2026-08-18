const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const resultsSection = document.getElementById('results-section');
const resultsContent = document.getElementById('results-content');
const closeResultsBtn = document.getElementById('close-results');
const lyricsSection = document.getElementById('lyrics-section');
const lyricsContent = document.getElementById('lyrics-content');
const lyricsTitle = document.getElementById('lyrics-title');
const lyricsArtistTag = document.getElementById('lyrics-artist-tag');
const closeLyricsBtn = document.getElementById('close-lyrics');

let searchTimeout = null;

// Handle Search Input Dynamics
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length > 0) {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
        resultsSection.classList.add('hidden');
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performMusicSearch(query);
    }, 400); // Debounce lookup
});

clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    resultsSection.classList.add('hidden');
    lyricsSection.classList.add('hidden');
    searchInput.focus();
});

closeResultsBtn.addEventListener('click', () => {
    resultsSection.classList.add('hidden');
});

closeLyricsBtn.addEventListener('click', () => {
    lyricsSection.classList.add('hidden');
});

// 1. Search Music Catalog via Public API (iTunes Search API ecosystem for 100% active endpoints)
async function performMusicSearch(query) {
    resultsSection.classList.remove('hidden');
    resultsContent.innerHTML = `<p class="placeholder-text">Searching Apple Music catalog...</p>`;

    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=8`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            renderSongList(data.results);
        } else {
            resultsContent.innerHTML = `<p class="placeholder-text">No tracks found matching "${query}"</p>`;
        }
    } catch (err) {
        resultsContent.innerHTML = `<p class="placeholder-text">Network error. Please check connection.</p>`;
    }
}

// 2. Render Search Results List inside Glass Card
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

        // When a song from the list is clicked, fetch and show lyrics
        item.addEventListener('click', () => {
            fetchLyrics(track.artistName, track.trackName);
        });

        resultsContent.appendChild(item);
    });
}

// 3. Fetch Synchronized/Standard Lyrics via Secure Repositories
async function fetchLyrics(artist, title) {
    resultsSection.classList.add('hidden');
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
            lyricsContent.innerHTML = `<p class="placeholder-text">Instrumental or lyrics unavailable for <b>${title}</b>.</p>`;
        }
    } catch (err) {
        lyricsContent.innerHTML = `<p class="placeholder-text">Could not load lyrics for this track selection.</p>`;
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
