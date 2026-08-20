// ==========================================
// LyricSpot - Main Application Script
// ==========================================

// ==========================================
// Dynamic Views Elements
// ==========================================

const views = {
    home: document.getElementById('home-view'),
    search: document.getElementById('search-view'),
    settings: document.getElementById('settings-view')
};

const headerSubtitle = document.getElementById('header-subtitle');

// ==========================================
// Navigation & Morphing Capsule Elements
// ==========================================

const floatingTabBar = document.getElementById('floating-tab-bar');
const tabHome = document.getElementById('tab-home');
const tabSettings = document.getElementById('tab-settings');
const searchTriggerBtn = document.getElementById('search-trigger-btn');
const searchInputWrapper = document.getElementById('search-input-wrapper');
const searchInput = document.getElementById('search-input');
const micBtn = document.getElementById('mic-btn');

// ==========================================
// Search & Lyrics Elements
// ==========================================

const resultsSection = document.getElementById('results-section');
const resultsContent = document.getElementById('results-content');
const lyricsSection = document.getElementById('lyrics-section');
const lyricsContent = document.getElementById('lyrics-content');
const lyricsTitle = document.getElementById('lyrics-title');
const lyricsArtistTag = document.getElementById('lyrics-artist-tag');
const fullscreenLyricsBtn = document.getElementById('fullscreen-lyrics-btn');
const backToResultsBtn = document.getElementById('back-to-results-btn');

// ==========================================
// Immersive Full-Screen Elements
// ==========================================

const immersiveView = document.getElementById('immersive-fullscreen-view');
const immersiveBackBtn = document.getElementById('immersive-back-btn');
const immersiveArtwork = document.getElementById('immersive-artwork');
const immersiveArtworkVideo = document.getElementById('immersive-artwork-video');
const immersiveSongTitle = document.getElementById('immersive-song-title');
const immersiveArtistName = document.getElementById('immersive-artist-name');
const immersiveLyricsContent = document.getElementById('immersive-lyrics-content');

// ==========================================
// Application State
// ==========================================

let searchTimeout = null;

// Current static artwork
let currentActiveArtworkUrl = '';

// Current selected track information
let currentActiveTrack = {
    title: '',
    artist: '',
    album: '',
    albumId: '',
    appleMusicUrl: '',
    artworkUrl: ''
};

// Used to prevent an older artwork request from
// replacing the artwork of a newly selected song.
let artworkRequestId = 0;

// Prevents duplicate hls.js loading.
let hlsLibraryPromise = null;

if (lyricsSection) {
    lyricsSection.classList.add('hidden');
}

// ==========================================
// Helper: Safe Element Listener
// ==========================================

function safeAddEventListener(element, event, handler) {
    if (element) {
        element.addEventListener(event, handler);
    }
}

// ==========================================
// Dynamic Artwork Motion Toggle
// ==========================================

const artworkMotionToggle = document.getElementById('artwork-motion-toggle');

const savedMotionState = localStorage.getItem(
    'lyricspot_artwork_motion'
);

if (savedMotionState === 'enabled') {
    if (artworkMotionToggle) {
        artworkMotionToggle.checked = true;
    }

    if (immersiveView) {
        immersiveView.classList.add('artwork-motion-active');
    }
} else {
    if (artworkMotionToggle) {
        artworkMotionToggle.checked = false;
    }

    if (immersiveView) {
        immersiveView.classList.remove('artwork-motion-active');
    }
}

safeAddEventListener(
    artworkMotionToggle,
    'change',
    (e) => {

        if (e.target.checked) {

            localStorage.setItem(
                'lyricspot_artwork_motion',
                'enabled'
            );

            if (immersiveView) {
                immersiveView.classList.add(
                    'artwork-motion-active'
                );
            }

        } else {

            localStorage.setItem(
                'lyricspot_artwork_motion',
                'disabled'
            );

            if (immersiveView) {
                immersiveView.classList.remove(
                    'artwork-motion-active'
                );
            }
        }
    }
);

// ==========================================
// Animated Artwork Cover Toggle
// ==========================================

const animatedCoverToggle =
    document.getElementById('animated-cover-toggle');

const savedAnimatedCoverState =
    localStorage.getItem(
        'lyricspot_animated_cover'
    );

if (savedAnimatedCoverState === 'enabled') {

    if (animatedCoverToggle) {
        animatedCoverToggle.checked = true;
    }

} else {

    if (animatedCoverToggle) {
        animatedCoverToggle.checked = false;
    }
}

// ==========================================
// Animated Artwork Toggle Change
// ==========================================

safeAddEventListener(
    animatedCoverToggle,
    'change',
    async (e) => {

        if (e.target.checked) {

            localStorage.setItem(
                'lyricspot_animated_cover',
                'enabled'
            );

        } else {

            localStorage.setItem(
                'lyricspot_animated_cover',
                'disabled'
            );
        }

        // Immediately update fullscreen artwork
        if (
            immersiveSongTitle &&
            immersiveArtistName
        ) {

            await updateImmersiveCoverMedia(
                immersiveSongTitle.textContent,
                immersiveArtistName.textContent,
                currentActiveArtworkUrl,
                currentActiveTrack.album,
                currentActiveTrack.albumId,
                currentActiveTrack.appleMusicUrl
            );
        }
    }
);

// ==========================================
// Check Whether Animated Artwork Is Enabled
// ==========================================

function isAnimatedArtworkEnabled() {

    return (
        localStorage.getItem(
            'lyricspot_animated_cover'
        ) === 'enabled'
    );
}

// ==========================================
// Escape URL For CSS
// ==========================================

function cssUrl(url) {

    if (!url) {
        return '';
    }

    return String(url)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

// ==========================================
// Set Static Artwork
// ==========================================

function setStaticImmersiveArtwork(
    artworkUrl
) {

    if (!artworkUrl) {
        return;
    }

    if (immersiveArtwork) {

        immersiveArtwork.src = artworkUrl;

        immersiveArtwork.classList.remove(
            'hidden'
        );
    }

    if (immersiveArtworkVideo) {

        immersiveArtworkVideo.pause();

        immersiveArtworkVideo.removeAttribute(
            'src'
        );

        immersiveArtworkVideo.load();

        immersiveArtworkVideo.classList.add(
            'hidden'
        );
    }

    if (immersiveView) {

        immersiveView.style.setProperty(
            '--immersive-bg-image',
            `url('${cssUrl(artworkUrl)}')`
        );
    }
}

// ==========================================
// Load hls.js Dynamically
// ==========================================

function loadHlsLibrary() {

    // Already available
    if (window.Hls) {
        return Promise.resolve(window.Hls);
    }

    // Already loading
    if (hlsLibraryPromise) {
        return hlsLibraryPromise;
    }

    hlsLibraryPromise = new Promise(
        (resolve, reject) => {

            const existingScript =
                document.querySelector(
                    'script[data-lyricspot-hls]'
                );

            if (existingScript) {

                existingScript.addEventListener(
                    'load',
                    () => resolve(window.Hls)
                );

                existingScript.addEventListener(
                    'error',
                    reject
                );

                return;
            }

            const script =
                document.createElement('script');

            script.src =
                'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';

            script.async = true;

            script.dataset.lyricspotHls =
                'true';

            script.onload = () => {

                if (window.Hls) {
                    resolve(window.Hls);
                } else {
                    reject(
                        new Error(
                            'hls.js loaded but Hls is unavailable.'
                        )
                    );
                }
            };

            script.onerror = () => {

                reject(
                    new Error(
                        'Unable to load hls.js.'
                    )
                );
            };

            document.head.appendChild(
                script
            );
        }
    );

    return hlsLibraryPromise;
}

// ==========================================
// Play HLS Artwork
// ==========================================

async function playHLSArtwork(
    hlsUrl,
    requestId
) {

    if (
        !immersiveArtworkVideo ||
        !hlsUrl
    ) {
        return false;
    }

    if (requestId !== artworkRequestId) {
        return false;
    }

    try {

        const Hls = await loadHlsLibrary();

        if (
            requestId !== artworkRequestId
        ) {
            return false;
        }

        // Native HLS support
        if (
            immersiveArtworkVideo.canPlayType(
                'application/vnd.apple.mpegurl'
            )
        ) {

            immersiveArtworkVideo.src =
                hlsUrl;

        } else if (
            Hls &&
            Hls.isSupported()
        ) {

            // Destroy previous HLS instance
            if (
                immersiveArtworkVideo._lyricspotHls
            ) {

                try {
                    immersiveArtworkVideo
                        ._lyricspotHls
                        .destroy();
                } catch (e) {}
            }

            const hls =
                new Hls({
                    enableWorker: true,
                    lowLatencyMode: false,
                    backBufferLength: 30
                });

            immersiveArtworkVideo
                ._lyricspotHls = hls;

            hls.loadSource(
                hlsUrl
            );

            hls.attachMedia(
                immersiveArtworkVideo
            );

        } else {

            return false;
        }

        immersiveArtworkVideo.loop = true;
        immersiveArtworkVideo.muted = true;
        immersiveArtworkVideo.playsInline = true;
        immersiveArtworkVideo.autoplay = true;

        immersiveArtworkVideo.classList.remove(
            'hidden'
        );

        if (immersiveArtwork) {
            immersiveArtwork.classList.add(
                'hidden'
            );
        }

        await immersiveArtworkVideo.play();

        return true;

    } catch (error) {

        console.warn(
            'LyricSpot HLS artwork playback failed:',
            error
        );

        return false;
    }
}

// ==========================================
// Play Direct MP4 Artwork
// ==========================================

async function playMP4Artwork(
    videoUrl,
    requestId
) {

    if (
        !immersiveArtworkVideo ||
        !videoUrl
    ) {
        return false;
    }

    if (
        requestId !== artworkRequestId
    ) {
        return false;
    }

    try {

        // Destroy old HLS instance if present
        if (
            immersiveArtworkVideo._lyricspotHls
        ) {

            try {

                immersiveArtworkVideo
                    ._lyricspotHls
                    .destroy();

            } catch (e) {}

            immersiveArtworkVideo
                ._lyricspotHls = null;
        }

        immersiveArtworkVideo.pause();

        immersiveArtworkVideo.src =
            videoUrl;

        immersiveArtworkVideo.loop =
            true;

        immersiveArtworkVideo.muted =
            true;

        immersiveArtworkVideo.playsInline =
            true;

        immersiveArtworkVideo.autoplay =
            true;

        immersiveArtworkVideo.classList.remove(
            'hidden'
        );

        if (immersiveArtwork) {

            immersiveArtwork.classList.add(
                'hidden'
            );
        }

        await immersiveArtworkVideo.play();

        return true;

    } catch (error) {

        console.warn(
            'LyricSpot MP4 artwork playback failed:',
            error
        );

        return false;
    }
}

// ==========================================
// Extract Artwork URLs From API Response
// ==========================================
//
// The public artwork service can expose different
// fields depending on the returned artwork variant.
// This function checks several possible names so
// the player is more resilient to API changes.
// ==========================================

function extractAnimatedArtwork(data) {

    if (!data) {
        return null;
    }

    // Some APIs return the artwork object directly.
    // Others return an array or nested result.

    let artwork = data;

    if (Array.isArray(data)) {

        artwork = data[0];

    } else if (
        Array.isArray(data.results)
    ) {

        artwork = data.results[0];

    } else if (
        Array.isArray(data.data)
    ) {

        artwork = data.data[0];

    } else if (
        data.result &&
        typeof data.result === 'object'
    ) {

        artwork = data.result;
    }

    if (!artwork) {
        return null;
    }

    // ------------------------------------------
    // Static artwork
    // ------------------------------------------

    const staticUrl =
        artwork.static ||
        artwork.staticUrl ||
        artwork.artwork ||
        artwork.artworkUrl ||
        artwork.preview ||
        artwork.previewUrl ||
        artwork.image ||
        artwork.imageUrl ||
        '';

    // ------------------------------------------
    // Prefer tall artwork for fullscreen lyrics
    // ------------------------------------------

    const tallVideo =
        artwork.tallVideoUrl ||
        artwork.tall_video_url ||
        artwork.tallMp4 ||
        artwork.tallMp4Url ||
        artwork.tall?.videoUrl ||
        artwork.tall?.mp4 ||
        artwork.tall?.video ||
        '';

    const tallHls =
        artwork.tallHlsUrl ||
        artwork.tall_hls_url ||
        artwork.tallHLS ||
        artwork.tall?.hlsUrl ||
        artwork.tall?.hls ||
        artwork.tall?.m3u8 ||
        '';

    // ------------------------------------------
    // Normal/square artwork
    // ------------------------------------------

    const videoUrl =
        artwork.videoUrl ||
        artwork.video_url ||
        artwork.mp4 ||
        artwork.mp4Url ||
        artwork.video ||
        '';

    const hlsUrl =
        artwork.hlsUrl ||
        artwork.hls_url ||
        artwork.hls ||
        artwork.m3u8 ||
        artwork.streamUrl ||
        '';

    // ------------------------------------------
    // Nested variants
    // ------------------------------------------

    const square =
        artwork.square ||
        artwork.squareCover ||
        artwork.squareArtwork ||
        {};

    const portrait =
        artwork.portrait ||
        artwork.tall ||
        artwork.tallCover ||
        artwork.tallArtwork ||
        {};

    const finalTallVideo =
        tallVideo ||
        portrait.videoUrl ||
        portrait.video ||
        portrait.mp4 ||
        portrait.mp4Url ||
        '';

    const finalTallHls =
        tallHls ||
        portrait.hlsUrl ||
        portrait.hls ||
        portrait.m3u8 ||
        '';

    const finalSquareVideo =
        videoUrl ||
        square.videoUrl ||
        square.video ||
        square.mp4 ||
        square.mp4Url ||
        '';

    const finalSquareHls =
        hlsUrl ||
        square.hlsUrl ||
        square.hls ||
        square.m3u8 ||
        '';

    // Tall is preferred for fullscreen.
    if (
        finalTallVideo ||
        finalTallHls
    ) {

        return {
            staticUrl,
            videoUrl: finalTallVideo,
            hlsUrl: finalTallHls,
            variant: 'tall'
        };
    }

    if (
        finalSquareVideo ||
        finalSquareHls
    ) {

        return {
            staticUrl,
            videoUrl: finalSquareVideo,
            hlsUrl: finalSquareHls,
            variant: 'square'
        };
    }

    return null;
}

// ==========================================
// Fetch Apple Music Motion Artwork
// ==========================================

async function fetchAnimatedArtwork(
    artist,
    album,
    title
) {

    if (!artist || !album) {
        return null;
    }

    try {

        const params =
            new URLSearchParams();

        params.set(
            'artist',
            artist
        );

        params.set(
            'album',
            album
        );

        if (title) {

            params.set(
                'title',
                title
            );
        }

        const apiUrl =
            `https://artwork.m8tec.top/api/v1/artwork/search?${params.toString()}`;

        const response =
            await fetch(
                apiUrl,
                {
                    method: 'GET',
                    headers: {
                        'Accept':
                            'application/json'
                    }
                }
            );

        if (!response.ok) {

            throw new Error(
                `Animated artwork API returned HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        return extractAnimatedArtwork(
            data
        );

    } catch (error) {

        console.warn(
            'LyricSpot animated artwork search failed:',
            error
        );

        return null;
    }
}

// ==========================================
// Update Immersive Cover Media
// ==========================================

async function updateImmersiveCoverMedia(
    title,
    artist,
    defaultArtworkUrl,
    album = '',
    albumId = '',
    appleMusicUrl = ''
) {

    const requestId =
        ++artworkRequestId;

    const staticArtwork =
        defaultArtworkUrl ||
        currentActiveArtworkUrl;

    // Always start with static artwork.
    // This prevents a blank screen while motion
    // artwork is being searched.
    setStaticImmersiveArtwork(
        staticArtwork
    );

    // If animation is disabled, stop here.
    if (
        !isAnimatedArtworkEnabled()
    ) {
        return;
    }

    // ------------------------------------------
    // Get album from current track if omitted
    // ------------------------------------------

    if (!album) {

        album =
            currentActiveTrack.album ||
            '';
    }

    if (!album) {

        console.warn(
            'LyricSpot: No album name available for animated artwork lookup.'
        );

        return;
    }

    try {

        const motion =
            await fetchAnimatedArtwork(
                artist,
                album,
                title
            );

        // A newer song was selected while this
        // request was running.
        if (
            requestId !== artworkRequestId
        ) {
            return;
        }

        // No motion artwork exists.
        if (!motion) {

            console.log(
                'LyricSpot: No Apple Music motion artwork found for:',
                artist,
                album
            );

            return;
        }

        // --------------------------------------
        // Update static preview if API provides one
        // --------------------------------------

        if (
            motion.staticUrl &&
            immersiveArtwork
        ) {

            immersiveArtwork.src =
                motion.staticUrl;

            if (immersiveView) {

                immersiveView.style.setProperty(
                    '--immersive-bg-image',
                    `url('${cssUrl(
                        motion.staticUrl
                    )}')`
                );
            }
        }

        // --------------------------------------
        // Prefer direct MP4
        // --------------------------------------

        if (motion.videoUrl) {

            const played =
                await playMP4Artwork(
                    motion.videoUrl,
                    requestId
                );

            if (played) {
                return;
            }
        }

        // --------------------------------------
        // Fall back to HLS
        // --------------------------------------

        if (motion.hlsUrl) {

            const played =
                await playHLSArtwork(
                    motion.hlsUrl,
                    requestId
                );

            if (played) {
                return;
            }
        }

        // --------------------------------------
        // If motion cannot be played,
        // static artwork remains visible.
        // --------------------------------------

        setStaticImmersiveArtwork(
            motion.staticUrl ||
            staticArtwork
        );

    } catch (error) {

        console.warn(
            'LyricSpot: Animated artwork unavailable:',
            error
        );

        // Never leave the player blank.
        setStaticImmersiveArtwork(
            staticArtwork
        );
    }
}

// ==========================================
// Stop Animated Artwork
// ==========================================

function stopAnimatedArtwork() {

    artworkRequestId++;

    if (!immersiveArtworkVideo) {
        return;
    }

    immersiveArtworkVideo.pause();

    // Destroy HLS instance
    if (
        immersiveArtworkVideo._lyricspotHls
    ) {

        try {

            immersiveArtworkVideo
                ._lyricspotHls
                .destroy();

        } catch (e) {}

        immersiveArtworkVideo
            ._lyricspotHls = null;
    }

    immersiveArtworkVideo.removeAttribute(
        'src'
    );

    immersiveArtworkVideo.load();

    immersiveArtworkVideo.classList.add(
        'hidden'
    );

    if (immersiveArtwork) {

        immersiveArtwork.classList.remove(
            'hidden'
        );
    }
}

// ==========================================
// Navigation
// ==========================================

safeAddEventListener(
    tabHome,
    'click',
    () => {

        if (
            floatingTabBar &&
            floatingTabBar.classList.contains(
                'search-expanded'
            )
        ) {
            collapseSearchCapsule();
        }

        switchView('home');
    }
);

safeAddEventListener(
    tabSettings,
    'click',
    () => {

        if (
            floatingTabBar &&
            floatingTabBar.classList.contains(
                'search-expanded'
            )
        ) {
            collapseSearchCapsule();
        }

        switchView('settings');
    }
);

safeAddEventListener(
    searchTriggerBtn,
    'click',
    (e) => {

        e.stopPropagation();

        expandSearchCapsule();
    }
);

function expandSearchCapsule() {

    if (!floatingTabBar) {
        return;
    }

    floatingTabBar.classList.add(
        'search-expanded'
    );

    if (searchInputWrapper) {
        searchInputWrapper.classList.remove(
            'hidden'
        );
    }

    switchView('search');

    if (tabHome) {
        tabHome.classList.remove(
            'active'
        );
    }

    if (tabSettings) {
        tabSettings.classList.remove(
            'active'
        );
    }

    if (searchTriggerBtn) {
        searchTriggerBtn.classList.add(
            'active'
        );
    }
}

function collapseSearchCapsule() {

    if (floatingTabBar) {

        floatingTabBar.classList.remove(
            'search-expanded'
        );
    }

    if (searchInputWrapper) {

        searchInputWrapper.classList.add(
            'hidden'
        );
    }

    if (searchTriggerBtn) {

        searchTriggerBtn.classList.remove(
            'active'
        );
    }

    if (resultsSection) {

        resultsSection.classList.add(
            'hidden'
        );
    }

    if (lyricsSection) {

        lyricsSection.classList.add(
            'hidden'
        );
    }

    if (searchInput) {

        searchInput.value = '';

        searchInput.blur();
    }
}

function switchView(targetView) {

    if (targetView === 'home') {

        if (tabHome) {
            tabHome.classList.add(
                'active'
            );
        }

        if (tabSettings) {
            tabSettings.classList.remove(
                'active'
            );
        }

        if (headerSubtitle) {

            headerSubtitle.textContent =
                'Welcome to your personal music lyric hub';
        }

    } else if (
        targetView === 'settings'
    ) {

        if (tabSettings) {
            tabSettings.classList.add(
                'active'
            );
        }

        if (tabHome) {
            tabHome.classList.remove(
                'active'
            );
        }

        if (headerSubtitle) {

            headerSubtitle.textContent =
                'Customize your Liquid Glass experience';
        }

    } else if (
        targetView === 'search'
    ) {

        if (headerSubtitle) {

            headerSubtitle.textContent =
                'Query global music catalogs instantly';
        }
    }

    Object.keys(views).forEach(
        key => {

            if (!views[key]) {
                return;
            }

            if (key === targetView) {

                views[key].classList.remove(
                    'hidden'
                );

            } else {

                views[key].classList.add(
                    'hidden'
                );
            }
        }
    );
}

safeAddEventListener(
    micBtn,
    'click',
    () => {

        if (searchInput) {
            searchInput.focus();
        }
    }
);

// ==========================================
// Theme Switcher
// ==========================================

const themeButtons =
    document.querySelectorAll(
        '.theme-btn'
    );

const bodyElement =
    document.body;

function applyTheme(themeMode) {

    if (!bodyElement) {
        return;
    }

    bodyElement.classList.remove(
        'light-theme',
        'dark-theme'
    );

    if (themeMode === 'light') {

        bodyElement.classList.add(
            'light-theme'
        );

    } else if (
        themeMode === 'dark'
    ) {

        bodyElement.classList.add(
            'dark-theme'
        );

    } else {

        const prefersDark =
            window.matchMedia(
                '(prefers-color-scheme: dark)'
            ).matches;

        if (prefersDark) {

            bodyElement.classList.add(
                'dark-theme'
            );

        } else {

            bodyElement.classList.add(
                'light-theme'
            );
        }
    }
}

themeButtons.forEach(
    btn => {

        btn.addEventListener(
            'click',
            () => {

                themeButtons.forEach(
                    b => b.classList.remove(
                        'active'
                    )
                );

                btn.classList.add(
                    'active'
                );

                const selectedTheme =
                    btn.getAttribute(
                        'data-theme'
                    );

                applyTheme(
                    selectedTheme
                );
            }
        );
    }
);

applyTheme('system');

// ==========================================
// Search Input
// ==========================================

safeAddEventListener(
    searchInput,
    'input',
    (e) => {

        const query =
            e.target.value.trim();

        if (query.length === 0) {

            if (resultsSection) {

                resultsSection.classList.add(
                    'hidden'
                );
            }

            return;
        }

        clearTimeout(
            searchTimeout
        );

        searchTimeout =
            setTimeout(
                () => {

                    performMusicSearch(
                        query
                    );

                },
                400
            );
    }
);

// ==========================================
// Back From Lyrics
// ==========================================

safeAddEventListener(
    backToResultsBtn,
    'click',
    () => {

        if (!lyricsSection) {
            return;
        }

        lyricsSection.style.transform =
            'translateX(40px)';

        lyricsSection.style.opacity =
            '0';

        setTimeout(
            () => {

                lyricsSection.classList.remove(
                    'fullscreen-mode'
                );

                lyricsSection.classList.add(
                    'hidden'
                );

                lyricsSection.style.transform =
                    '';

                lyricsSection.style.opacity =
                    '';

                if (resultsSection) {

                    resultsSection.classList.remove(
                        'hidden'
                    );

                    resultsSection.style.transform =
                        'translateX(-30px)';

                    resultsSection.style.opacity =
                        '0';

                    requestAnimationFrame(
                        () => {

                            resultsSection.style.transition =
                                'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';

                            resultsSection.style.transform =
                                'translateX(0)';

                            resultsSection.style.opacity =
                                '1';
                        }
                    );
                }

            },
            200
        );
    }
);

// ==========================================
// Fullscreen Lyrics Button
// ==========================================

safeAddEventListener(
    fullscreenLyricsBtn,
    'click',
    () => {

        openImmersiveFullScreen();
    }
);

// ==========================================
// Music Search
// ==========================================

async function performMusicSearch(
    query
) {

    if (!resultsSection || !resultsContent) {
        return;
    }

    resultsSection.classList.remove(
        'hidden'
    );

    resultsContent.innerHTML =
        `<p class="placeholder-text">Searching wide music catalogs...</p>`;

    try {

        const response =
            await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(
                    query
                )}&entity=song&limit=15`
            );

        const data =
            await response.json();

        if (
            data.results &&
            data.results.length > 0
        ) {

            renderSongList(
                data.results
            );

        } else {

            resultsContent.innerHTML =
                `<p class="placeholder-text">No tracks found matching "${escapeHTML(
                    query
                )}"</p>`;
        }

    } catch (err) {

        console.error(
            'Music search error:',
            err
        );

        resultsContent.innerHTML =
            `<p class="placeholder-text">Network connection error.</p>`;
    }
}

// ==========================================
// Clean Title
// ==========================================

function cleanTitleForQuery(
    title
) {

    return title
        .replace(
            /[\(\[].*?[\)\]]/g,
            ''
        )
        .replace(
            /[-–—]\s*(Single Version|Remix|Radio Edit|Acoustic|Live).*$/i,
            ''
        )
        .trim();
}

// ==========================================
// Lyrics
// ==========================================

async function getLyricsData(
    artist,
    title,
    durationMs = 0
) {

    const cleanTitle =
        cleanTitleForQuery(
            title
        );

    const durationSec =
        durationMs
            ? Math.round(
                durationMs / 1000
            )
            : 0;

    // ------------------------------------------
    // LRCLIB exact search
    // ------------------------------------------

    if (durationSec) {

        try {

            const exactRes =
                await fetch(
                    `https://lrclib.net/api/get?track_name=${encodeURIComponent(
                        cleanTitle
                    )}&artist_name=${encodeURIComponent(
                        artist
                    )}&duration=${durationSec}`
                );

            if (exactRes.ok) {

                const exactData =
                    await exactRes.json();

                if (
                    exactData &&
                    exactData.plainLyrics &&
                    exactData.plainLyrics.length > 10
                ) {

                    return exactData.plainLyrics;
                }
            }

        } catch (e) {}
    }

    // ------------------------------------------
    // LRCLIB search
    // ------------------------------------------

    try {

        const lrclibRes =
            await fetch(
                `https://lrclib.net/api/search?track_name=${encodeURIComponent(
                    cleanTitle
                )}&artist_name=${encodeURIComponent(
                    artist
                )}`
            );

        const lrclibData =
            await lrclibRes.json();

        if (
            Array.isArray(lrclibData) &&
            lrclibData.length > 0
        ) {

            const match =
                lrclibData.find(
                    item =>
                        item.plainLyrics &&
                        item.plainLyrics.length > 10
                );

            if (match) {

                return match.plainLyrics;
            }
        }

    } catch (e) {}

    // ------------------------------------------
    // lyrics.ovh fallback
    // ------------------------------------------

    try {

        const res =
            await fetch(
                `https://api.lyrics.ovh/v1/${encodeURIComponent(
                    artist
                )}/${encodeURIComponent(
                    title
                )}`
            );

        const data =
            await res.json();

        if (
            data &&
            data.lyrics &&
            data.lyrics.length > 15
        ) {

            return data.lyrics;
        }

    } catch (e) {}

    return null;
}

// ==========================================
// Render Search Results
// ==========================================

function renderSongList(
    tracks
) {

    if (!resultsContent) {
        return;
    }

    resultsContent.innerHTML =
        '';

    tracks.forEach(
        (track, index) => {

            const item =
                document.createElement(
                    'div'
                );

            item.className =
                'song-item';

            const artworkUrl =
                track.artworkUrl100
                    ? track.artworkUrl100.replace(
                        '100x100bb',
                        '600x600bb'
                    )
                    : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600';

            // ----------------------------------
            // IMPORTANT:
            // collectionName is the album name.
            // We need this later to find motion
            // artwork.
            // ----------------------------------

            const albumName =
                track.collectionName ||
                '';

            item.innerHTML = `
                <span
                    class="availability-dot"
                    id="dot-${index}"
                    title="Checking..."
                ></span>

                <img
                    src="${escapeHTML(
                        artworkUrl
                    )}"
                    class="song-thumb"
                    alt="Art"
                >

                <div class="song-meta">
                    <h4>
                        ${escapeHTML(
                            track.trackName || ''
                        )}
                    </h4>

                    <p>
                        ${escapeHTML(
                            track.artistName || ''
                        )}
                    </p>
                </div>
            `;

            // ----------------------------------
            // Check lyrics availability
            // ----------------------------------

            getLyricsData(
                track.artistName,
                track.trackName,
                track.trackTimeMillis
            ).then(
                lyrics => {

                    const dot =
                        document.getElementById(
                            `dot-${index}`
                        );

                    if (!dot) {
                        return;
                    }

                    if (lyrics) {

                        dot.classList.add(
                            'available'
                        );

                        dot.title =
                            'Lyrics available';

                    } else {

                        dot.classList.add(
                            'unavailable'
                        );

                        dot.title =
                            'Lyrics unavailable';
                    }
                }
            );

            // ----------------------------------
            // Song selected
            // ----------------------------------

            item.addEventListener(
                'click',
                () => {

                    currentActiveArtworkUrl =
                        artworkUrl;

                    currentActiveTrack = {

                        title:
                            track.trackName ||
                            '',

                        artist:
                            track.artistName ||
                            '',

                        album:
                            albumName,

                        albumId:
                            track.collectionId
                                ? String(
                                    track.collectionId
                                )
                                : '',

                        appleMusicUrl:
                            track.trackViewUrl ||
                            '',

                        artworkUrl:
                            artworkUrl
                    };

                    resultsSection.style.transition =
                        'transform 0.3s ease, opacity 0.25s ease';

                    resultsSection.style.transform =
                        'translateX(-40px)';

                    resultsSection.style.opacity =
                        '0';

                    setTimeout(
                        () => {

                            resultsSection.classList.add(
                                'hidden'
                            );

                            resultsSection.style.transform =
                                '';

                            resultsSection.style.opacity =
                                '';

                            fetchAndDisplayLyrics(
                                track.artistName,
                                track.trackName,
                                track.trackTimeMillis
                            );

                        },
                        250
                    );
                }
            );

            resultsContent.appendChild(
                item
            );
        }
    );
}

// ==========================================
// Immersive Back Button
// ==========================================

safeAddEventListener(
    immersiveBackBtn,
    'click',
    () => {

        closeImmersiveFullScreen();
    }
);

// ==========================================
// Open Immersive Fullscreen
// ==========================================

function openImmersiveFullScreen() {

    if (!immersiveView) {
        return;
    }

    const songTitleText =
        lyricsTitle
            ? lyricsTitle.textContent
            : currentActiveTrack.title;

    const artistNameText =
        lyricsArtistTag
            ? lyricsArtistTag.textContent
            : currentActiveTrack.artist;

    if (immersiveSongTitle) {

        immersiveSongTitle.textContent =
            songTitleText;
    }

    if (immersiveArtistName) {

        immersiveArtistName.textContent =
            artistNameText;
    }

    if (immersiveLyricsContent) {

        immersiveLyricsContent.innerHTML =
            lyricsContent
                ? lyricsContent.innerHTML
                : '';
    }

    // ------------------------------------------
    // Set static artwork immediately
    // ------------------------------------------

    setStaticImmersiveArtwork(
        currentActiveArtworkUrl
    );

    // ------------------------------------------
    // Load motion artwork if enabled
    // ------------------------------------------

    updateImmersiveCoverMedia(
        songTitleText,
        artistNameText,
        currentActiveArtworkUrl,
        currentActiveTrack.album,
        currentActiveTrack.albumId,
        currentActiveTrack.appleMusicUrl
    );

    // ------------------------------------------
    // Dynamic Artwork Motion setting
    // ------------------------------------------

    if (
        localStorage.getItem(
            'lyricspot_artwork_motion'
        ) === 'enabled'
    ) {

        immersiveView.classList.add(
            'artwork-motion-active'
        );

    } else {

        immersiveView.classList.remove(
            'artwork-motion-active'
        );
    }

    immersiveView.classList.remove(
        'hidden'
    );

    document.body.style.overflow =
        'hidden';
}

// ==========================================
// Close Immersive Fullscreen
// ==========================================

function closeImmersiveFullScreen() {

    if (!immersiveView) {
        return;
    }

    stopAnimatedArtwork();

    immersiveView.classList.add(
        'hidden'
    );

    document.body.style.overflow =
        '';
}

// ==========================================
// Fetch & Display Lyrics
// ==========================================

async function fetchAndDisplayLyrics(
    artist,
    title,
    durationMs
) {

    if (!lyricsSection) {
        return;
    }

    lyricsSection.classList.remove(
        'hidden'
    );

    lyricsSection.style.transform =
        'translateX(40px)';

    lyricsSection.style.opacity =
        '0';

    requestAnimationFrame(
        () => {

            lyricsSection.style.transition =
                'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';

            lyricsSection.style.transform =
                'translateX(0)';

            lyricsSection.style.opacity =
                '1';
        }
    );

    lyricsSection.classList.remove(
        'fullscreen-mode'
    );

    if (fullscreenLyricsBtn) {

        fullscreenLyricsBtn.textContent =
            'See full lyrics...';
    }

    if (lyricsTitle) {

        lyricsTitle.textContent =
            title;
    }

    if (lyricsArtistTag) {

        lyricsArtistTag.textContent =
            artist;
    }

    if (lyricsContent) {

        lyricsContent.innerHTML =
            `<p class="placeholder-text">Fetching lyrics for "${escapeHTML(
                title
            )}"...</p>`;
    }

    const lyrics =
        await getLyricsData(
            artist,
            title,
            durationMs
        );

    if (lyrics) {

        if (lyricsContent) {

            lyricsContent.textContent =
                lyrics;
        }

    } else {

        if (lyricsContent) {

            lyricsContent.innerHTML =
                `<p class="placeholder-text">Lyrics unavailable for <b>${escapeHTML(
                    title
                )}</b> across public catalogs.</p>`;
        }
    }
}

// ==========================================
// Escape HTML
// ==========================================

function escapeHTML(
    str
) {

    return String(
        str || ''
    ).replace(
        /[&<>'"]/g,
        tag =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
    );
}

// ==========================================
// Dynamic Ambient Mesh Toggle
// ==========================================

const ambientMeshToggle =
    document.getElementById(
        'ambient-mesh-toggle'
    );

const meshBgElement =
    document.querySelector(
        '.mesh-bg'
    );

const savedMeshState =
    localStorage.getItem(
        'lyricspot_ambient_mesh'
    );

if (
    savedMeshState === 'enabled'
) {

    if (ambientMeshToggle) {

        ambientMeshToggle.checked =
            true;
    }

    if (meshBgElement) {

        meshBgElement.classList.add(
            'mesh-animated'
        );
    }

} else {

    if (ambientMeshToggle) {

        ambientMeshToggle.checked =
            false;
    }

    if (meshBgElement) {

        meshBgElement.classList.remove(
            'mesh-animated'
        );
    }
}

safeAddEventListener(
    ambientMeshToggle,
    'change',
    (e) => {

        if (e.target.checked) {

            if (meshBgElement) {

                meshBgElement.classList.add(
                    'mesh-animated'
                );
            }

            localStorage.setItem(
                'lyricspot_ambient_mesh',
                'enabled'
            );

        } else {

            if (meshBgElement) {

                meshBgElement.classList.remove(
                    'mesh-animated'
                );
            }

            localStorage.setItem(
                'lyricspot_ambient_mesh',
                'disabled'
            );
        }
    }
);
