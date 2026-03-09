const API_BASE = "https://xodisharemix-backend.onrender.com";

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

const formatMiniTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const initMiniCornerPlayer = async () => {
  if (window.location.pathname.includes('player.html')) return;

  const mini = document.createElement('section');
  mini.id = 'miniCornerPlayer';
  mini.className = 'mini-corner-player hidden';
  mini.innerHTML = `
    <button id="miniClose" class="mini-corner-close" aria-label="Close">×</button>
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

  const render = () => {
    const song = queue[currentIndex];
    if (!song) return;
    cover.src = song.imagePath;
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

  const loadTrack = async (idx, autoPlay = false) => {
    if (!queue.length) return;
    currentIndex = (idx + queue.length) % queue.length;
    const song = queue[currentIndex];
    render();
    audio.src = song.songPath;
    mini.classList.remove('hidden');
    document.body.classList.add('has-mini-corner-player');
    if (autoPlay) {
      try {
        await audio.play();
      } catch (_error) {}
    }
    toggle.textContent = audio.paused ? 'Play' : 'Pause';
  };

  window.playInMini = async (songId) => {
    if (!queue.length) return;
    const idx = queue.findIndex((s) => s._id === songId);
    await loadTrack(idx >= 0 ? idx : 0, true);
  };

  toggle.addEventListener('click', async () => {
    if (audio.paused) {
      try {
        await audio.play();
      } catch (_error) {}
    } else {
      audio.pause();
    }
    toggle.textContent = audio.paused ? 'Play' : 'Pause';
  });

  prev.addEventListener('click', () => loadTrack(currentIndex - 1, true));
  next.addEventListener('click', () => loadTrack(currentIndex + 1, true));
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
  audio.addEventListener('ended', () => loadTrack(currentIndex + 1, true));
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

