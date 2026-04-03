const API_BASE = window.location.origin;
const MINI_RESUME_KEY = 'xodiMiniResume';

const categories = [
  { key: 'trending_latest', label: 'Trending / Latest' },
  { key: 'sound_check', label: 'Sound Check' },
  { key: 'private_track', label: 'Private Track' },
  { key: 'bhajan_mix', label: 'Bhajan Mix' },
];

const withAuth = () => {
  const token = localStorage.getItem('xodiToken') || localStorage.getItem('xodiAdminToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatDate = (dateString) => new Date(dateString).toLocaleString();

const categoryLabel = (key) => categories.find((c) => c.key === key)?.label || key;

const showLoader = (show) => {
  const loader = document.getElementById('pageLoader');
  if (!loader) return;
  loader.classList.toggle('hidden', !show);
};

const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
};

const resolveMediaUrl = (urlPath) => {
  if (!urlPath) return '';
  if (/^https?:\/\//i.test(urlPath)) return urlPath;
  const normalized = String(urlPath).startsWith('/') ? urlPath : `/${urlPath}`;
  return `${API_BASE}${normalized}`;
};

const formatMiniTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const initMiniCornerPlayer = async () => {
  window.playInMini = () => {};
  if (window.location.pathname.includes('player.html')) return;

  const mini = document.createElement('section');
  mini.id = 'miniCornerPlayer';
  mini.className = 'mini-corner-player hidden';
  mini.innerHTML = `
    <button id="miniClose" class="mini-corner-close" aria-label="Close">&times;</button>
    <img id="miniCover" class="mini-corner-cover mini-clickable" alt="Now playing" />
    <div class="mini-corner-meta">
      <strong id="miniTitle" class="mini-clickable">Now Playing</strong>
      <small id="miniArtist">xodisharemix</small>
    </div>
    <div class="mini-corner-controls">
      <button id="miniPrev" class="mini-corner-btn">Prev</button>
      <button id="miniToggle" class="mini-corner-btn mini-corner-play">Play</button>
      <button id="miniNext" class="mini-corner-btn">Next</button>
      <a id="miniDownload" class="mini-corner-btn mini-corner-download" href="#">Download</a>
    </div>
    <div class="mini-corner-time">
      <small id="miniCurrentTime">0:00</small>
      <small id="miniTotalTime">0:00</small>
    </div>
    <input id="miniSeek" class="mini-corner-range" type="range" min="0" max="100" value="0" />
    <audio id="miniAudio" preload="metadata"></audio>
  `;
  document.body.appendChild(mini);

  let queue = [];
  try {
    const res = await fetch(`${API_BASE}/api/songs`);
    if (!res.ok) return;
    const data = await res.json();
    queue = data.songs || [];
  } catch (_error) {
    queue = [];
  }

  const audio = document.getElementById('miniAudio');
  const cover = document.getElementById('miniCover');
  const title = document.getElementById('miniTitle');
  const artist = document.getElementById('miniArtist');
  const download = document.getElementById('miniDownload');
  const seek = document.getElementById('miniSeek');
  const currentTime = document.getElementById('miniCurrentTime');
  const totalTime = document.getElementById('miniTotalTime');
  const toggle = document.getElementById('miniToggle');
  const prev = document.getElementById('miniPrev');
  const next = document.getElementById('miniNext');
  const close = document.getElementById('miniClose');

  let currentIndex = 0;
  let miniSwitchToken = 0;
  let miniVolume = 1;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const fadeMiniTo = async (target, duration = 220) => {
    const start = Number.isFinite(audio.volume) ? audio.volume : 1;
    const steps = 10;
    const stepDuration = Math.max(10, Math.floor(duration / steps));

    for (let i = 1; i <= steps; i += 1) {
      const value = start + ((target - start) * i) / steps;
      audio.volume = Math.min(1, Math.max(0, value));
      await wait(stepDuration);
    }
  };

  const render = () => {
    const song = queue[currentIndex];
    if (!song) return;
    cover.src = resolveMediaUrl(song.imagePath);
    title.textContent = song.title;
    artist.textContent = song.artist;
    download.href = `${API_BASE}/api/songs/${song._id}/download`;
    download.setAttribute('download', song.title);
    currentTime.textContent = '0:00';
    totalTime.textContent = '0:00';
  };

  const openFullPlayer = () => {
    const song = queue[currentIndex];
    if (!song) return;
    window.location.href = `/player.html?id=${song._id}`;
  };

  const loadTrack = async (idx, options = {}) => {
    const { autoPlay = false, startAt = 0, volume = 1 } = options;
    if (!queue.length) return;
    const token = ++miniSwitchToken;
    currentIndex = (idx + queue.length) % queue.length;
    const song = queue[currentIndex];

    if (!audio.paused && audio.src) {
      await fadeMiniTo(0, 220);
      if (token !== miniSwitchToken) return;
      audio.pause();
    }

    render();
    audio.src = resolveMediaUrl(song.songPath);
    audio.currentTime = 0;
    miniVolume = Number.isFinite(Number(volume)) ? Math.max(0, Math.min(1, Number(volume))) : miniVolume;
    audio.volume = autoPlay ? 0 : miniVolume;
    mini.classList.remove('hidden');
    document.body.classList.add('has-mini-corner-player');

    if (Number.isFinite(Number(startAt)) && Number(startAt) > 0) {
      const resumeAt = Number(startAt);
      audio.addEventListener('loadedmetadata', () => {
        audio.currentTime = Math.min(resumeAt, audio.duration || resumeAt);
      }, { once: true });
    }

    if (autoPlay) {
      try {
        await audio.play();
      } catch (_error) {}
      if (token !== miniSwitchToken) return;
      await fadeMiniTo(miniVolume, 220);
    }
    toggle.textContent = audio.paused ? 'Play' : 'Pause';
  };

  window.playInMini = async (songId) => {
    if (!queue.length) return;
    const idx = queue.findIndex((s) => s._id === songId);
    await loadTrack(idx >= 0 ? idx : 0, { autoPlay: true });
  };

  toggle.addEventListener('click', async () => {
    if (audio.paused) {
      try {
        audio.volume = 0;
        await audio.play();
        await fadeMiniTo(miniVolume, 180);
      } catch (_error) {}
    } else {
      audio.pause();
    }
    toggle.textContent = audio.paused ? 'Play' : 'Pause';
  });

  prev.addEventListener('click', () => loadTrack(currentIndex - 1, { autoPlay: true }));
  next.addEventListener('click', () => loadTrack(currentIndex + 1, { autoPlay: true }));
  close.addEventListener('click', () => {
    audio.pause();
    mini.classList.add('hidden');
    document.body.classList.remove('has-mini-corner-player');
  });
  cover.addEventListener('click', openFullPlayer);
  title.addEventListener('click', openFullPlayer);

  seek.addEventListener('input', () => {
    if (!audio.duration) return;
    audio.currentTime = (Number(seek.value) / 100) * audio.duration;
    currentTime.textContent = formatMiniTime(audio.currentTime);
  });

  audio.addEventListener('loadedmetadata', () => {
    totalTime.textContent = formatMiniTime(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    seek.value = String((audio.currentTime / audio.duration) * 100);
    currentTime.textContent = formatMiniTime(audio.currentTime);
  });
  audio.addEventListener('ended', () => loadTrack(currentIndex + 1, { autoPlay: true }));

  // Resume mini-player from the full player state, if available.
  const resumeRaw = localStorage.getItem(MINI_RESUME_KEY);
  if (resumeRaw && queue.length) {
    try {
      const resume = JSON.parse(resumeRaw);
      const idx = queue.findIndex((s) => s._id === resume.songId);
      if (idx >= 0) {
        const elapsed = resume.wasPlaying && resume.savedAt
          ? Math.max(0, (Date.now() - Number(resume.savedAt)) / 1000)
          : 0;
        const startAt = Math.max(0, Number(resume.currentTime || 0) + elapsed);
        await loadTrack(idx, {
          autoPlay: Boolean(resume.wasPlaying),
          startAt,
          volume: Number(resume.volume),
        });
      }
    } catch (_error) {
      // ignore invalid local storage payload
    } finally {
      localStorage.removeItem(MINI_RESUME_KEY);
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  setTheme('dark');

  const themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      setTheme(current);
    });
  }

  setTimeout(() => showLoader(false), 300);
  initMiniCornerPlayer();
});

