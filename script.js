const APPLE_MUSIC_DEVELOPER_TOKEN = "YOUR_APPLE_MUSIC_DEVELOPER_TOKEN_HERE"; 

let music = null;
const authBtn = document.getElementById('auth-btn');
const nowPlayingCard = document.getElementById('now-playing-card');
const trackTitleEl = document.getElementById('track-title');
const trackArtistEl = document.getElementById('track-artist');
const trackArtEl = document.getElementById('track-art');
const connectionStatusEl = document.getElementById('connection-status');
const lyricsSection = document.getElementById('lyrics-section');
const lyricsContent = document.getElementById('lyrics-content');
const lyricsTitle = document.getElementById('lyrics-title');
const closeLyricsBtn = document.getElementById('close-lyrics');

// 1. Initialize MusicKit JS & Device Session Handlers
document.addEventListener('musickitloaded', async () => {
    try {
        await MusicKit.configure({
            developerToken: APPLE_MUSIC_DEVELOPER_TOKEN,
            app: { name: 'LyricSpot', build: '26.1.0' }
        });
        music = MusicKit.getInstance();
        if (music.isAuthorized) {
            updateAuthUI(true);
            syncAppleMusicPlayback();
        }
    } catch (error) {
        console.error("MusicKit configuration failed:", error);
    }
});

// 2. Real-time Device Audio Reader via Media Session API & MusicKit
function pollDeviceAudio() {
    // If browser supports Media Session metadata reading from system output
    if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
        const meta = navigator.mediaSession.metadata;
        trackTitleEl.textContent = meta.title || "Active Device Audio";
        trackArtistEl.textContent = meta.artist || "Unknown Artist";
        connectionStatusEl.textContent = "Live System Audio Synced";
        
        if (meta.artwork && meta.artwork.length > 0) {
            trackArtEl.src = meta.artwork[meta.artwork.length - 1].src;
        }
    }

    // If Apple Music is actively playing
    if (music && music.isAuthorized && music.nowPlayingItem) {
        const item = music.nowPlayingItem;
        trackTitleEl.textContent = item.title;
        trackArtistEl.textContent = item.artistName;
        if (item.artwork && item.artwork.url) {
            trackArtEl.src = item.artwork.url.replace('{w}', '300').replace('{h}', '300');
        }
        connectionStatusEl.textContent = "Apple Music Synced";
    }
}

setInterval(pollDeviceAudio, 1500);

authBtn.addEventListener('click', async () => {
    if (!music) {
        alert("MusicKit initializing. Try again shortly.");
        return;
    }
    if (!music.isAuthorized) {
        try {
            await music.authorize();
            updateAuthUI(true);
        } catch (err) {
            console.error("Auth error:", err);
        }
    } else {
        await music.unauthorize();
        updateAuthUI(false);
    }
});

function updateAuthUI(isAuthed) {
    if (isAuthed) {
        authBtn.textContent = "Disconnect";
        connectionStatusEl.textContent = "Apple Music Connected";
    } else {
        authBtn.textContent = "Connect Apple Music";
        connectionStatusEl.textContent = "Detecting device audio...";
    }
}

// 3. Tap card to fetch lyrics instantly
nowPlayingCard.addEventListener('click', async () => {
    const title = trackTitleEl.textContent;
    const artist = trackArtistEl.textContent;

    if (title === "No Song Playing" || title === "Active Device Audio") {
        alert("Play a song on your device first!");
        return;
    }

    lyricsSection.classList.remove('hidden');
    lyricsTitle.textContent = `${title} — Lyrics`;
    lyricsContent.innerHTML = `<p class="placeholder-text">Searching lyrics database for "${title}"...</p>`;

    try {
        const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
        const data = await response.json();

        if (data.lyrics) {
            lyricsContent.innerHTML = `<p>${data.lyrics.replace(/\n/g, '<br>')}</p>`;
        } else {
            fetchFallbackLyrics(artist, title);
        }
    } catch (e) {
        fetchFallbackLyrics(artist, title);
    }
});

async function fetchFallbackLyrics(artist, title) {
    try {
        const altResponse = await fetch(`https://some-random-api.com/others/lyrics?title=${encodeURIComponent(title)}`);
        const altData = await altResponse.json();
        if (altData && altData.lyrics) {
            lyricsContent.innerHTML = `<p>${altData.lyrics.replace(/\n/g, '<br>')}</p>`;
        } else {
            lyricsContent.innerHTML = `<p class="placeholder-text">Lyrics unavailable for: <b>${title}</b></p>`;
        }
    } catch (err) {
        lyricsContent.innerHTML = `<p class="placeholder-text">Could not load lyrics securely.</p>`;
    }
}

closeLyricsBtn.addEventListener('click', () => {
    lyricsSection.classList.add('hidden');
});
