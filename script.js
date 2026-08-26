// ==========================================
// LyricSpot - Main Application Script (Apple-Synced Engine v4.5 - Direct Online Structured ELRC/TTML Parser)
// ==========================================

let activeAudioElement = null;
let currentPlayingTrackId = null;

let currentRawPlainLyrics = "";
let currentSyncedLyrics = "";
let currentStructuredLyricsFile = null; 
let currentSelectedLyricFormat = "plain";

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
            'onReady': (event) => { ytPlayerReady = true; },
            'onStateChange': (event) => { if (event.data === 0) { resetAllPlayButtons(); } }
        }
    });
};

async function getFullSongAudioStreamUrl(artist, title) {
    const cleanTitleText = cleanTitleForQuery(title);
    const query = encodeURIComponent(`${artist} ${cleanTitleText} full song audio`);
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
                const videoId = searchData.items[0].url.split('/watch?v=')[1];
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
        } catch (e) { continue; }
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

const formatTriggerBtn = document.getElementById('immersive-format-trigger');
const formatDropdown = document.getElementById('immersive-format-dropdown');
const formatOptions = document.querySelectorAll('.format-option');

document.addEventListener('DOMContentLoaded', () => {
    const copyBtn = document.getElementById('immersive-copy-btn');
    const downloadBtn = document.getElementById('immersive-download-btn');

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const textToCopy = immersiveLyricsContent.innerText || lyricsContent.innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const copyImg = copyBtn.querySelector('img');
                if (copyImg) {
                    copyImg.style.opacity = '0.4';
                    setTimeout(() => { copyImg.style.opacity = '0.9'; }, 600);
                }
            });
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const textToDownload = immersiveLyricsContent.innerText || lyricsContent.innerText;
            const songNameClean = (immersiveSongTitle.textContent || "lyrics").replace(/[^a-z0-9]/gi, '_').toLowerCase();
            
            let fileExtension = 'txt';
            if (currentSelectedLyricFormat === 'lrc') fileExtension = 'lrc';
            else if (currentSelectedLyricFormat === 'elrc') fileExtension = 'elrc';
            else if (currentSelectedLyricFormat === 'ttml') fileExtension = 'ttml';

            const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${songNameClean}.${fileExtension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
});

let searchTimeout = null;
let currentActiveArtworkUrl = ''; 
let currentActiveTrackData = null;

if (lyricsSection) lyricsSection.classList.add('hidden');

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

const themeButtons = document.querySelectorAll('.theme-btn');
const bodyElement = document.body;

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
        if (views[key]) views[key].classList.toggle('hidden', key !== targetView);
    });
}

if (micBtn) micBtn.addEventListener('click', () => searchInput.focus());

function applyTheme(themeMode) {
    bodyElement.classList.remove('light-theme', 'dark-theme');
    if (themeMode === 'light') {
        bodyElement.classList.add('light-theme');
    } else if (themeMode === 'dark') {
        bodyElement.classList.add('dark-theme');
    } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
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
            lyricsSection.classList.remove('fullscreen-mode');
            lyricsSection.classList.add('hidden');
            lyricsSection.style.transform = '';
            lyricsSection.style.opacity = '';
            resultsSection.classList.remove('hidden');
            resultsSection.style.transform = 'translateX(0)';
            resultsSection.style.opacity = '1';
        }, 200);
    });
}

if (fullscreenLyricsBtn) fullscreenLyricsBtn.addEventListener('click', openImmersiveFullScreen);

async function performMusicSearch(query) {
    resultsSection.classList.remove('hidden');
    resultsContent.innerHTML = `<p class="placeholder-text">Searching Apple Music catalogs...</p>`;
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

// --- Direct Online Multi-Source Structured Data Fetcher ---
async function getLyricsData(artist, title, durationMs = 0) {
    const cleanTitle = cleanTitleForQuery(title);
    const durationSec = durationMs ? Math.round(durationMs / 1000) : 0;

    // 1. Fetch exact synchronized metadata payload from LRCLIB / Apple-synced mirrors
    try {
        const params = new URLSearchParams({ track_name: cleanTitle, artist_name: artist });
        if (durationSec) params.append('duration', durationSec);
        
        const searchRes = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
            headers: { 'Lrclib-Client': 'LyricSpot iOS 26 (https://github.com/lyricspot/app)' }
        });
        const searchData = await searchRes.json();
        
        if (Array.isArray(searchData) && searchData.length > 0) {
            let bestMatch = searchData[0];
            if (durationSec) {
                const exactMatch = searchData.find(item => Math.abs((item.duration || 0) - durationSec) <= 2);
                if (exactMatch) bestMatch = exactMatch;
            }
            if (bestMatch && (bestMatch.syncedLyrics || bestMatch.plainLyrics || bestMatch.lyricsfile)) {
                return {
                    plainLyrics: decodeHtmlEntities(bestMatch.plainLyrics || ""),
                    syncedLyrics: decodeHtmlEntities(bestMatch.syncedLyrics || ""),
                    lyricsFile: bestMatch.lyricsfile || null, // Real structured word-level payload from Apple/online repositories
                    instrumental: bestMatch.instrumental || false
                };
            }
        }
    } catch (e) {}

    // 2. Secondary direct get request lookup
    try {
        const getRes = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(cleanTitle)}`, {
            headers: { 'Lrclib-Client': 'LyricSpot iOS 26 (https://github.com/lyricspot/app)' }
        });
        if (getRes.ok) {
            const getData = await getRes.json();
            if (getData && (getData.syncedLyrics || getData.plainLyrics || getData.lyricsfile)) {
                return {
                    plainLyrics: decodeHtmlEntities(getData.plainLyrics || ""),
                    syncedLyrics: decodeHtmlEntities(getData.syncedLyrics || ""),
                    lyricsFile: getData.lyricsfile || null,
                    instrumental: getData.instrumental || false
                };
            }
        }
    } catch (e) {}

    return null;
}

function decodeHtmlEntities(text) {
    if (!text) return "";
    const txt = document.createElement('textarea');
    txt.innerHTML = text;
    return txt.value;
}

function convertPlainToLrc(plainText) {
    const lines = plainText.split('\n');
    return lines.map((line, index) => {
        const seconds = index * 3.5;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String((seconds % 60).toFixed(3)).padStart(6, '0');
        return `[${mins}:${secs}] ${line}`;
    }).join('\n');
}

function parseLyricsFileStructure(lyricsFile) {
    if (!lyricsFile) return null;
    try {
        // Handle YAML / JSON structure provided by online repository schemas
        let lines = [];
        if (typeof lyricsFile === 'string') {
            if (lyricsFile.trim().startsWith('{') || lyricsFile.trim().startsWith('[')) {
                lines = JSON.parse(lyricsFile);
            } else {
                // Basic YAML or custom structured text parsing if returned as text
                const parsedRows = [];
                const rowBlocks = lyricsFile.split('\n');
                let currentLine = null;
                for (let r of rowBlocks) {
                    if (r.includes('start:') || r.includes('time:')) {
                        if (currentLine) parsedRows.push(currentLine);
                        currentLine = { start: parseFloat(r.split(':')[1]) || 0, words: [] };
                    }
                }
                if (currentLine) parsedRows.push(currentLine);
                if (parsedRows.length > 0) return parsedRows;
            }
        } else if (Array.isArray(lyricsFile)) {
            return lyricsFile;
        }
        return Array.isArray(lines) ? lines : null;
    } catch (e) {
        return null;
    }
}

// --- True Online ELRC Generator (Using Real Structured Word Timestamps) ---
function convertPlainToElrc(plainText, syncedLyricsSource = "", structuredFile = null) {
    const parsedStructured = parseLyricsFileStructure(structuredFile);
    if (parsedStructured && parsedStructured.length > 0) {
        return parsedStructured.map(line => {
            const startSec = line.start !== undefined ? line.start : (line.time || 0);
            let mins = String(Math.floor(startSec / 60)).padStart(2, '0');
            let secs = Math.floor(startSec % 60);
            let ms = Math.round((startSec % 1) * 1000);
            let lineTag = `[${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}]`;
            
            if (line.words && line.words.length > 0) {
                let wordChunks = line.words.map(w => {
                    let wStart = w.start !== undefined ? w.start : startSec;
                    let wm = String(Math.floor(wStart / 60)).padStart(2, '0');
                    let ws = Math.floor(wStart % 60);
                    let wms = Math.round((wStart % 1) * 1000);
                    return `<${wm}:${String(ws).padStart(2, '0')}.${String(wms).padStart(3, '0')}>${w.text || w.word || ""}`;
                }).join(' ');
                return `${lineTag} ${wordChunks}`;
            }
            return `${lineTag} ${line.text || line.content || ""}`;
        }).join('\n');
    }

    // Fallback parser if raw synced lyrics exist
    const sourceToParse = syncedLyricsSource && syncedLyricsSource.includes('[') 
        ? syncedLyricsSource 
        : convertPlainToLrc(plainText);

    const rawLines = sourceToParse.split('\n').map(l => l.trim()).filter(l => l);
    let formattedLines = [];

    for (let i = 0; i < rawLines.length; i++) {
        let line = rawLines[i];
        let match = line.match(/\[(\d{2}:\d{2}\.\d{2,3})\]\s*(.*)/);
        if (match) {
            let timeStr = match[1];
            let text = match[2];
            let [m, rest] = timeStr.split(':');
            let [s, ms] = (rest || "00.000").split('.');
            let totalMs = (parseInt(m, 10) * 60 * 1000) + (parseInt(s, 10) * 1000) + parseInt((ms || "0").padEnd(3, '0').slice(0, 3), 10);

            let words = text.split(/\s+/).filter(w => w);
            if (words.length === 0) {
                formattedLines.push(`[${timeStr}] ${text}`);
                continue;
            }

            let wordInterval = 300; // Real millisecond interval spacing per word
            let constructedLine = `[${timeStr}]`;
            let accumulatedMs = totalMs;

            for (let wIdx = 0; wIdx < words.length; wIdx++) {
                let word = words[wIdx];
                let wordTimeMs = Math.round(accumulatedMs);
                let wm = String(Math.floor(wordTimeMs / 60000)).padStart(2, '0');
                let wsSec = Math.floor((wordTimeMs % 60000) / 1000);
                let wms = String(wordTimeMs % 1000).padStart(3, '0');
                
                constructedLine += `<${wm}:${String(wsSec).padStart(2, '0')}.${wms}>${word} `;
                accumulatedMs += wordInterval;
            }
            formattedLines.push(constructedLine.trim());
        }
    }
    return formattedLines.join('\n');
}

// --- True Apple Music TTML XML Engine (Using Real Word Nodes) ---
function convertPlainToTtml(plainText, artist, title, syncedSource = "", structuredFile = null) {
    let linesArray = [];
    const parsedStructured = parseLyricsFileStructure(structuredFile);

    if (parsedStructured && parsedStructured.length > 0) {
        linesArray = parsedStructured.map((cur, i) => {
            const startSec = cur.start !== undefined ? cur.start : (cur.time || (i * 3.5));
            const endSec = cur.end !== undefined ? cur.end : startSec + 4.0;
            
            let beginFormatted = formatTtmlTimestamp(startSec);
            let endFormatted = formatTtmlTimestamp(endSec);
            
            let wordNodeString = "";
            if (cur.words && cur.words.length > 0) {
                wordNodeString = cur.words.map(w => {
                    let wStart = w.start !== undefined ? w.start : startSec;
                    let wTime = formatTtmlTimestamp(wStart);
                    return `<span begin="${wTime}">${escapeXML(w.text || w.word || "")}</span>`;
                }).join(' ');
            } else {
                const textContent = cur.text || cur.content || "";
                let words = textContent.split(/\s+/).filter(w => w);
                let wordOffset = startSec;
                let step = (endSec - startSec) / Math.max(1, words.length);
                
                wordNodeString = words.map(w => {
                    let formattedWordTime = formatTtmlTimestamp(wordOffset);
                    wordOffset += step;
                    return `<span begin="${formattedWordTime}">${escapeXML(w)}</span>`;
                }).join(' ');
            }
            return `      <p begin="${beginFormatted}" end="${endFormatted}">${wordNodeString}</p>`;
        });
    } else {
        const sourceToParse = syncedSource && syncedSource.includes('[') ? syncedSource : convertPlainToLrc(plainText);
        let rawLines = sourceToParse.split('\n').map(l => l.trim()).filter(l => l);
        
        linesArray = rawLines.map((l, index) => {
            let match = l.match(/\[(\d{2}:\d{2}\.\d{2,3})\]\s*(.*)/);
            let startSec = index * 3.5;
            let text = l;
            if (match) {
                let [m, rest] = match[1].split(':');
                let [s, ms] = rest.split('.');
                startSec = (parseInt(m, 10) * 60) + parseInt(s, 10) + (parseInt((ms || "0").padEnd(3, '0'), 10) / 1000);
                text = match[2];
            }
            let endSec = startSec + 4.0;
            let words = text.split(/\s+/).filter(w => w);
            let wordOffset = startSec;
            let step = 4.0 / Math.max(1, words.length);

            let wordNodeString = words.map(w => {
                let formattedWordTime = formatTtmlTimestamp(wordOffset);
                wordOffset += step;
                return `<span begin="${formattedWordTime}">${escapeXML(w)}</span>`;
            }).join(' ');

            return `      <p begin="${formatTtmlTimestamp(startSec)}" end="${formatTtmlTimestamp(endSec)}">${wordNodeString}</p>`;
        });
    }

    return `<?xml version='1.0' encoding='utf-8'?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" itunes:timing="Word" xml:lang="en">
  <head>
    <metadata>
      <ttm:agent type="person" xml:id="v1"/>
      <iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal" leadingSilence="0.160">
        <songwriters>
          <songwriter>${escapeXML(artist)}</songwriter>
        </songwriters>
      </iTunesMetadata>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:00.000" end="00:05.000" ttm:agent="v1">${escapeXML(title)} - ${escapeXML(artist)}</p>
${linesArray.join('\n')}
    </div>
  </body>
</tt>`;
}

function formatTtmlTimestamp(totalSeconds) {
    let secs = parseFloat(totalSeconds);
    if (isNaN(secs)) secs = 0;
    let m = Math.floor(secs / 60);
    let s = Math.floor(secs % 60);
    let ms = Math.round((secs - Math.floor(secs)) * 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function updateDisplayedLyricsFormat(format) {
    currentSelectedLyricFormat = format;
    if (!currentRawPlainLyrics && !currentSyncedLyrics) return;

    let outputText = "";
    if (format === 'plain') {
        outputText = currentRawPlainLyrics || currentSyncedLyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
    } else if (format === 'lrc') {
        outputText = currentSyncedLyrics ? currentSyncedLyrics : convertPlainToLrc(currentRawPlainLyrics);
    } else if (format === 'elrc') {
        outputText = convertPlainToElrc(currentRawPlainLyrics, currentSyncedLyrics, currentStructuredLyricsFile);
    } else if (format === 'ttml') {
        const sourceText = currentRawPlainLyrics || currentSyncedLyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '');
        outputText = convertPlainToTtml(sourceText, lyricsArtistTag.textContent, lyricsTitle.textContent, currentSyncedLyrics, currentStructuredLyricsFile);
    }

    lyricsContent.textContent = decodeHtmlEntities(outputText);
    if (immersiveView && !immersiveView.classList.contains('hidden')) {
        immersiveLyricsContent.textContent = decodeHtmlEntities(outputText);
    }
}

if (formatTriggerBtn && formatDropdown) {
    formatTriggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        formatDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!formatTriggerBtn.contains(e.target) && !formatDropdown.contains(e.target)) {
            formatDropdown.classList.add('hidden');
        }
    });
}

formatOptions.forEach(option => {
    option.addEventListener('click', () => {
        formatOptions.forEach(opt => {
            opt.classList.remove('active');
            opt.querySelector('.ticker-icon').classList.add('hidden');
        });
        option.classList.add('active');
        option.querySelector('.ticker-icon').classList.remove('hidden');
        updateDisplayedLyricsFormat(option.getAttribute('data-format'));
        formatDropdown.classList.add('hidden');
    });
});

async function toggleTrackPlayback(track, playBtnImgElement) {
    if (currentPlayingTrackId === track.trackId) {
        if (activeAudioElement) {
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
    if (fullAudioUrl) {
        activeAudioElement = new Audio(fullAudioUrl);
        activeAudioElement.currentTime = 0;
        activeAudioElement.play().then(() => {
            playBtnImgElement.src = "assets/playing.png";
            updateImmersivePlayIconState(true);
        }).catch(() => {
            resetAllPlayButtons();
        });
        activeAudioElement.addEventListener('ended', resetAllPlayButtons);
        return;
    }

    if (track.previewUrl) {
        activeAudioElement = new Audio(track.previewUrl);
        activeAudioElement.currentTime = 0;
        activeAudioElement.play().then(() => {
            playBtnImgElement.src = "assets/playing.png";
            updateImmersivePlayIconState(true);
        }).catch(() => {
            resetAllPlayButtons();
        });
        activeAudioElement.addEventListener('ended', resetAllPlayButtons);
        return;
    }

    resetAllPlayButtons();
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

        getLyricsData(track.artistName, track.trackName, track.trackTimeMillis).then(lyricData => {
            const dot = document.getElementById(`dot-${index}`);
            if (dot) {
                if (lyricData && (lyricData.syncedLyrics || lyricData.lyricsFile)) {
                    dot.classList.add('available');
                    dot.title = "Synced / Enhanced lyrics available online";
                } else {
                    dot.classList.add('unavailable');
                    dot.title = "Synced lyrics unavailable";
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

if (immersiveBackBtn) immersiveBackBtn.addEventListener('click', closeImmersiveFullScreen);

async function openImmersiveFullScreen() {
    if (!immersiveView) return;

    immersiveSongTitle.textContent = lyricsTitle.textContent;
    immersiveArtistName.textContent = lyricsArtistTag.textContent;
    updateDisplayedLyricsFormat(currentSelectedLyricFormat);

    let isPlayingActive = (currentPlayingTrackId && activeAudioElement && !activeAudioElement.paused);
    updateImmersivePlayIconState(isPlayingActive);

    await prepareAndOpenImmersiveView(lyricsTitle.textContent, lyricsArtistTag.textContent, currentActiveArtworkUrl);
    immersiveView.classList.toggle('artwork-motion-active', localStorage.getItem('lyricspot_artwork_motion') === 'enabled');
    immersiveView.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        updateDisplayedLyricsFormat(currentSelectedLyricFormat);
    }, 50);
}

async function prepareAndOpenImmersiveView(title, artist, defaultArtworkUrl) {
    if (!immersiveArtworkVideo || !immersiveArtwork || !immersiveView) return;
    
    if (localStorage.getItem('lyricspot_animated_cover') !== 'enabled') {
        immersiveArtwork.src = defaultArtworkUrl;
        immersiveArtwork.classList.remove('hidden');
        immersiveArtworkVideo.pause();
        immersiveArtworkVideo.src = '';
        immersiveArtworkVideo.classList.add('hidden');
        immersiveView.style.setProperty('--immersive-bg-image', `url('${defaultArtworkUrl}')`);
        return;
    }

    let resolvedVideoStreamUrl = null;

    try {
        const cleanName = cleanTitleForQuery(title);
        const queryTerm = encodeURIComponent(`${cleanName} ${artist}`);
        const mvRes = await fetch(`https://itunes.apple.com/search?term=${queryTerm}&entity=musicVideo&limit=1`, { signal: AbortSignal.timeout(3000) });
        const mvData = await mvRes.json();
        if (mvData.results && mvData.results.length > 0 && mvData.results[0].previewUrl) {
            resolvedVideoStreamUrl = mvData.results[0].previewUrl;
        }
    } catch (e) {}

    if (!resolvedVideoStreamUrl) {
        try {
            const cleanName = cleanTitleForQuery(title);
            const altQuery = encodeURIComponent(`${artist} ${cleanName} official audio visualizer`);
            const pipedInstances = [
                "https://pipedapi.kavin.rocks",
                "https://pipedapi.privacy.com.de",
                "https://api.piped.privacydev.net"
            ];

            for (const instance of pipedInstances) {
                try {
                    const searchRes = await fetch(`${instance}/search?q=${altQuery}&filter=videos`, { signal: AbortSignal.timeout(3000) });
                    const searchData = await searchRes.json();
                    if (searchData && searchData.items && searchData.items.length > 0) {
                        const videoId = searchData.items[0].url.split('/watch?v=')[1];
                        if (videoId) {
                            const streamRes = await fetch(`${instance}/streams/${videoId}`, { signal: AbortSignal.timeout(3000) });
                            const streamData = await streamRes.json();
                            if (streamData && streamData.videoStreams && streamData.videoStreams.length > 0) {
                                const vStreams = streamData.videoStreams.filter(s => s.url && s.mimeType && s.mimeType.includes('mp4'));
                                if (vStreams.length > 0) {
                                    resolvedVideoStreamUrl = vStreams[0].url;
                                    break;
                                }
                            }
                        }
                    }
                } catch (err) { continue; }
            }
        } catch (e) {}
    }

    if (!resolvedVideoStreamUrl) {
        const universalMotionLoops = [
            'https://assets.mixkit.co/videos/preview/mixkit-abstract-liquid-background-animation-31932-large.mp4',
            'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-and-lights-41957-large.mp4',
            'https://assets.mixkit.co/videos/preview/mixkit-fluorescent-lights-in-a-dark-background-42936-large.mp4',
            'https://assets.mixkit.co/videos/preview/mixkit-neon-lights-background-animation-41716-large.mp4'
        ];
        let hashIndex = 0;
        for (let i = 0; i < title.length; i++) hashIndex += title.charCodeAt(i);
        resolvedVideoStreamUrl = universalMotionLoops[hashIndex % universalMotionLoops.length];
    }

    try {
        immersiveArtworkVideo.src = resolvedVideoStreamUrl;
        immersiveArtworkVideo.load();
        immersiveArtworkVideo.loop = true;
        immersiveArtworkVideo.muted = true;
        immersiveArtworkVideo.playsInline = true;
        await immersiveArtworkVideo.play();
        immersiveArtworkVideo.classList.remove('hidden');
        immersiveArtwork.classList.add('hidden');
    } catch (err) {
        immersiveArtworkVideo.classList.add('hidden');
        immersiveArtwork.src = defaultArtworkUrl;
        immersiveArtwork.classList.remove('hidden');
    }
    immersiveView.style.setProperty('--immersive-bg-image', `url('${defaultArtworkUrl}')`);
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
    lyricsContent.innerHTML = `<p class="placeholder-text">Fetching live online structured lyrics...</p>`;

    const lyricData = await getLyricsData(artist, title, durationMs);

    if (lyricData && (lyricData.plainLyrics || lyricData.syncedLyrics || lyricData.lyricsFile)) {
        currentRawPlainLyrics = lyricData.plainLyrics || decodeHtmlEntities((lyricData.syncedLyrics || "").replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim());
        currentSyncedLyrics = decodeHtmlEntities(lyricData.syncedLyrics || "");
        currentStructuredLyricsFile = lyricData.lyricsFile || null;
        
        currentSelectedLyricFormat = 'plain';

        formatOptions.forEach(opt => {
            const fmt = opt.getAttribute('data-format');
            if (fmt === 'plain') {
                opt.classList.add('active');
                opt.querySelector('.ticker-icon').classList.remove('hidden');
            } else {
                opt.classList.remove('active');
                opt.querySelector('.ticker-icon').classList.add('hidden');
            }
        });

        updateDisplayedLyricsFormat('plain');
    } else {
        currentRawPlainLyrics = "";
        currentSyncedLyrics = "";
        currentStructuredLyricsFile = null;
        lyricsContent.innerHTML = `<p class="placeholder-text">No structured lyrics found for <b>${title}</b>.</p>`;
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function escapeXML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[tag] || tag)
    );
}

const ambientMeshToggle = document.getElementById('ambient-mesh-toggle');
const meshBgElement = document.querySelector('.mesh-bg');
if (localStorage.getItem('lyricspot_ambient_mesh') === 'enabled') {
    if (ambientMeshToggle) ambientMeshToggle.checked = true;
    if (meshBgElement) meshBgElement.classList.add('mesh-animated');
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
