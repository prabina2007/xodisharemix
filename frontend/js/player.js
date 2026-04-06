let queue = [];
let currentIndex = 0;
let audio;
let switchToken = 0;
let currentVolume = 1;
let eqContext;
let eqNodesReady = false;
let bassFilter;
let midFilter;
let trebleFilter;
let analyser;
let visualizerFrame;
const eqState = { bass: 0, mid: 0, treble: 0 };

const params = new URLSearchParams(window.location.search);
const songId = params.get('id');
const TRANSITION_MS = 260;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fadeTo = async (target, duration) => {
  const start = Number.isFinite(audio.volume) ? audio.volume : 1;
  const steps = 10;
  const stepDuration = Math.max(12, Math.floor(duration / steps));

  for (let i = 1; i <= steps; i += 1) {
    const value = start + ((target - start) * i) / steps;
    audio.volume = Math.min(1, Math.max(0, value));
    await wait(stepDuration);
  }
};

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const saveMiniResumeStateAndGoHome = () => {
  if (!queue.length || !queue[currentIndex]) {
    window.location.href = '/index.html';
    return;
  }

  const song = queue[currentIndex];
  const payload = {
    songId: song._id,
    currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
    wasPlaying: !audio.paused,
    volume: Number.isFinite(audio.volume) ? audio.volume : 1,
    savedAt: Date.now(),
  };

  localStorage.setItem('xodiMiniResume', JSON.stringify(payload));
  window.location.href = '/index.html';
};

const setPlayPauseLabel = () => {
  const btn = document.getElementById('playPauseBtn');
  if (!btn || !audio) return;
  btn.textContent = audio.paused ? 'Play' : 'Pause';
};

const updatePlayerMeta = () => {
  const song = queue[currentIndex];
  if (!song) return;

  const categoryBadge = document.getElementById('playerCategoryBadge');
  const queueCountBadge = document.getElementById('queueCountBadge');

  if (categoryBadge) categoryBadge.textContent = categoryLabel(song.category);
  if (queueCountBadge) queueCountBadge.textContent = `${queue.length} songs`;
};

const renderQueue = () => {
  const root = document.getElementById('queueList');
  root.innerHTML = queue
    .map((song, idx) => `<div class="queue-item ${idx === currentIndex ? 'active' : ''}" onclick="playIndex(${idx})"><strong>${idx + 1}. ${song.title}</strong><br/><small class="muted">${song.artist}</small></div>`)
    .join('');
  updatePlayerMeta();
};

const renderRecentSongCards = () => {
  const root = document.getElementById('playerRecentGrid');
  if (!root) return;

  const recentSongs = [...queue];
  if (!recentSongs.length) {
    root.innerHTML = '<p class="muted">No recent uploads yet.</p>';
    return;
  }

  root.innerHTML = recentSongs
    .map((song) => `
      <article class="song-card glass song-card-interactive player-recent-card" onclick="playSongById('${song._id}')">
        <div class="cover-wrap">
          <img class="song-cover" src="${resolveMediaUrl(song.imagePath)}" alt="${song.title}" />
          <button class="btn btn-primary play-overlay-btn" onclick="event.stopPropagation(); playSongById('${song._id}')">Play</button>
        </div>
        <div class="song-body">
          <h4>${song.title}</h4>
          <p class="song-meta">${song.artist}</p>
          <div class="song-card-footer">
            <small class="muted">${categoryLabel(song.category)}</small>
            <span class="song-open-hint">Play now</span>
          </div>
        </div>
      </article>`)
    .join('');
};

const playSongById = async (id) => {
  const idx = queue.findIndex((song) => song._id === id);
  if (idx < 0) return;
  await playIndex(idx, true);
  const top = document.querySelector('.player-wrap');
  if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.playSongById = playSongById;
const syncQueueCardHeight = () => {
  const nowCard = document.querySelector('.now-playing-card');
  const queueCard = document.querySelector('.queue-card');
  if (!nowCard || !queueCard) return;

  if (window.matchMedia('(max-width: 900px)').matches) {
    queueCard.style.height = '';
    queueCard.style.minHeight = '';
    queueCard.style.maxHeight = '';
    return;
  }

  const nowHeight = Math.ceil(nowCard.getBoundingClientRect().height);
  queueCard.style.height = `${nowHeight}px`;
  queueCard.style.minHeight = `${nowHeight}px`;
  queueCard.style.maxHeight = `${nowHeight}px`;
};

const createVisualizerBars = (rootId, count = 34) => {
  const root = document.getElementById(rootId);
  if (!root) return [];
  root.innerHTML = Array.from({ length: count }, () => '<span class="eq-bar"></span>').join('');
  return Array.from(root.querySelectorAll('.eq-bar'));
};

const startVisualizer = () => {
  if (!analyser) return;
  const mainBars = createVisualizerBars('eqVisualizer');
  const queueBars = createVisualizerBars('queueEqVisualizer');
  const barSets = [mainBars, queueBars].filter((set) => set.length > 0);
  if (!barSets.length) return;
  const barCount = barSets[0].length;

  const data = new Uint8Array(analyser.frequencyBinCount);
  const heights = new Array(barCount).fill(1);
  const smoothBins = new Array(barCount).fill(0);
  const bassHistory = [];
  let prevBass = 0;
  let beatPulse = 0;
  let beatCooldown = 0;
  let globalLevel = 0;

  const draw = () => {
    if (audio.paused) {
      heights.forEach((_, i) => {
        heights[i] += (1 - heights[i]) * 0.45;
        barSets.forEach((bars) => {
          bars[i].style.height = `${Math.max(1, heights[i]).toFixed(2)}%`;
          bars[i].style.opacity = '0.3';
        });
      });
      visualizerFrame = requestAnimationFrame(draw);
      return;
    }

    analyser.getByteFrequencyData(data);

    const bassBins = Math.max(3, Math.floor(data.length * 0.1));
    let bassSum = 0;
    for (let i = 0; i < bassBins; i += 1) {
      const weight = 1.45 - (i / bassBins) * 0.55;
      bassSum += data[i] * weight;
    }
    const bassEnergy = (bassSum / bassBins) / 255;
    let totalEnergy = 0;
    for (let i = 0; i < data.length; i += 1) totalEnergy += data[i];
    const overallEnergy = (totalEnergy / data.length) / 255;
    globalLevel = globalLevel * 0.86 + overallEnergy * 0.14;

    bassHistory.push(bassEnergy);
    if (bassHistory.length > 42) bassHistory.shift();
    const bassAvg = bassHistory.reduce((acc, val) => acc + val, 0) / (bassHistory.length || 1);
    const bassDelta = bassEnergy - prevBass;
    prevBass = prevBass * 0.78 + bassEnergy * 0.22;

    const beatDetected = beatCooldown <= 0
      && bassEnergy > bassAvg * 1.22
      && bassDelta > 0.016;

    if (beatDetected) {
      beatPulse = Math.min(1, beatPulse + (bassEnergy - bassAvg) * 2.8 + 0.2);
      beatCooldown = 8;
    } else {
      beatPulse *= 0.88;
      beatCooldown = Math.max(0, beatCooldown - 1);
    }

    const quietFrame = globalLevel < 0.06;
    const globalGate = quietFrame ? 0.14 : Math.min(1, 0.28 + globalLevel * 1.35 + beatPulse * 0.42);

    heights.forEach((_, i) => {
      const start = Math.floor(((i / barCount) ** 2.05) * data.length * 0.96);
      const end = Math.max(start + 1, Math.floor((((i + 1) / barCount) ** 2.05) * data.length * 0.96));
      let sum = 0;
      for (let j = start; j < end; j += 1) sum += data[j];
      const avg = sum / (end - start || 1);
      const energy = avg / 255;
      smoothBins[i] = smoothBins[i] * 0.74 + energy * 0.26;

      const bassWeight = Math.pow(1 - (i / barCount), 1.35);
      const shapedEnergy = Math.pow(smoothBins[i], 1.28);
      const target = Math.min(
        100,
        Math.max(
          1,
          1 + (shapedEnergy * 78 + bassEnergy * 26 * bassWeight + beatPulse * 24 * bassWeight) * globalGate,
        ),
      );

      const attack = 0.63;
      const release = quietFrame ? 0.48 : 0.26;
      const smoothing = target > heights[i] ? attack : release;
      heights[i] += (target - heights[i]) * smoothing;
      const barHeight = `${heights[i].toFixed(2)}%`;
      const barOpacity = `${Math.min(1, 0.34 + heights[i] / 120)}`;
      barSets.forEach((bars) => {
        bars[i].style.height = barHeight;
        bars[i].style.opacity = barOpacity;
      });
    });

    visualizerFrame = requestAnimationFrame(draw);
  };

  if (visualizerFrame) cancelAnimationFrame(visualizerFrame);
  draw();
};

const initEqualizer = () => {
  if (eqNodesReady || !audio || !window.AudioContext) return;

  eqContext = new window.AudioContext();
  const source = eqContext.createMediaElementSource(audio);

  bassFilter = eqContext.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 200;
  bassFilter.gain.value = 0;

  midFilter = eqContext.createBiquadFilter();
  midFilter.type = 'peaking';
  midFilter.frequency.value = 1000;
  midFilter.Q.value = 1;
  midFilter.gain.value = 0;

  trebleFilter = eqContext.createBiquadFilter();
  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 3200;
  trebleFilter.gain.value = eqState.treble;

  analyser = eqContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.55;

  source.connect(bassFilter);
  bassFilter.connect(midFilter);
  midFilter.connect(trebleFilter);
  trebleFilter.connect(analyser);
  analyser.connect(eqContext.destination);

  bassFilter.gain.value = eqState.bass;
  midFilter.gain.value = eqState.mid;
  trebleFilter.gain.value = eqState.treble;

  eqNodesReady = true;
  startVisualizer();
};

const syncEqualizerUI = () => {
  const controlSets = [
    {
      bass: document.getElementById('bassEq'),
      mid: document.getElementById('midEq'),
      treble: document.getElementById('trebleEq'),
      reset: document.getElementById('resetEqBtn'),
    },
    {
      bass: document.getElementById('bassEqQueue'),
      mid: document.getElementById('midEqQueue'),
      treble: document.getElementById('trebleEqQueue'),
      reset: document.getElementById('resetEqBtnQueue'),
    },
  ].filter((set) => set.bass && set.mid && set.treble && set.reset);

  if (!controlSets.length) return;

  const applyStateToFilters = () => {
    if (bassFilter) bassFilter.gain.value = eqState.bass;
    if (midFilter) midFilter.gain.value = eqState.mid;
    if (trebleFilter) trebleFilter.gain.value = eqState.treble;
  };

  const syncInputsFromState = () => {
    controlSets.forEach((set) => {
      set.bass.value = String(eqState.bass);
      set.mid.value = String(eqState.mid);
      set.treble.value = String(eqState.treble);
    });
  };

  const applyFromSet = (set) => {
    eqState.bass = Number(set.bass.value);
    eqState.mid = Number(set.mid.value);
    eqState.treble = Number(set.treble.value);
    syncInputsFromState();
    applyStateToFilters();
  };

  controlSets.forEach((set) => {
    set.bass.addEventListener('input', () => applyFromSet(set));
    set.mid.addEventListener('input', () => applyFromSet(set));
    set.treble.addEventListener('input', () => applyFromSet(set));
    set.reset.addEventListener('click', () => {
      eqState.bass = 0;
      eqState.mid = 0;
      eqState.treble = 0;
      syncInputsFromState();
      applyStateToFilters();
    });
  });

  syncInputsFromState();
  applyStateToFilters();
};

const loadSong = async (song, forcePlay = true) => {
  const token = ++switchToken;
  document.getElementById('songCover').src = song.imagePath;
  document.getElementById('songTitle').textContent = song.title;
  document.getElementById('songArtist').textContent = song.artist;
  document.getElementById('downloadBtn').href = `${API_BASE}/api/songs/${song._id}/download`;
  document.getElementById('downloadBtn').setAttribute('download', song.title);

  document.getElementById('currentTime').textContent = '0:00';
  document.getElementById('totalTime').textContent = '0:00';

  if (!audio.paused && audio.src) {
    await fadeTo(0, TRANSITION_MS);
    if (token !== switchToken) return;
    audio.pause();
  }

  audio.src = song.songPath;
  audio.currentTime = 0;
  audio.volume = 0;

  if (forcePlay) {
    try {
      await audio.play();
    } catch (_error) {
      audio.volume = currentVolume;
    }
    if (token !== switchToken) return;
    await fadeTo(currentVolume, TRANSITION_MS);
  } else {
    audio.volume = currentVolume;
  }

  setPlayPauseLabel();
  renderQueue();
  renderRecentSongCards();
  syncQueueCardHeight();
};

const playIndex = async (idx, forcePlay = true) => {
  currentIndex = idx;
  await loadSong(queue[currentIndex], forcePlay);
};

window.playIndex = playIndex;

window.addEventListener('DOMContentLoaded', async () => {
  audio = document.getElementById('audioPlayer');
  audio.crossOrigin = 'anonymous';
  syncEqualizerUI();
  initEqualizer();

  const allRes = await fetch(`${API_BASE}/api/songs`);
  const allData = await allRes.json();
  queue = (allData.songs || []).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (!queue.length) return;

  if (songId) {
    const found = queue.findIndex((s) => s._id === songId);
    currentIndex = found >= 0 ? found : 0;
  }
  await loadSong(queue[currentIndex], false);

  const playPauseBtn = document.getElementById('playPauseBtn');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const openMiniBtn = document.getElementById('openMiniBtn');
  const progress = document.getElementById('progressBar');
  const volume = document.getElementById('volumeBar');
  const currentTime = document.getElementById('currentTime');
  const totalTime = document.getElementById('totalTime');

  playPauseBtn.addEventListener('click', async () => {
    initEqualizer();
    if (eqContext && eqContext.state === 'suspended') {
      try { await eqContext.resume(); } catch (_error) {}
    }
    if (audio.paused) {
      try {
        await audio.play();
      } catch (_error) {}
    } else {
      audio.pause();
    }
    setPlayPauseLabel();
  });
  nextBtn.addEventListener('click', () => {
    playIndex((currentIndex + 1) % queue.length, true);
  });
  prevBtn.addEventListener('click', () => {
    playIndex((currentIndex - 1 + queue.length) % queue.length, true);
  });
  openMiniBtn.addEventListener('click', saveMiniResumeStateAndGoHome);

  audio.addEventListener('loadedmetadata', () => {
    totalTime.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    progress.value = (audio.currentTime / audio.duration) * 100;
    currentTime.textContent = formatTime(audio.currentTime);
  });

  progress.addEventListener('input', () => {
    if (!audio.duration) return;
    audio.currentTime = (progress.value / 100) * audio.duration;
    currentTime.textContent = formatTime(audio.currentTime);
  });

  volume.addEventListener('input', () => {
    currentVolume = Number(volume.value);
    audio.volume = currentVolume;
  });

  audio.addEventListener('play', async () => {
    initEqualizer();
    if (eqContext && eqContext.state === 'suspended') {
      try { await eqContext.resume(); } catch (_error) {}
    }
    setPlayPauseLabel();
  });
  audio.addEventListener('pause', setPlayPauseLabel);

  audio.addEventListener('ended', () => nextBtn.click());

  if (!audio.paused) {
    initEqualizer();
    if (eqContext && eqContext.state === 'suspended') {
      try { await eqContext.resume(); } catch (_error) {}
    }
  }

  setPlayPauseLabel();
  renderQueue();
  renderRecentSongCards();
  syncQueueCardHeight();
  window.addEventListener('resize', syncQueueCardHeight);

  const cover = document.getElementById('songCover');
  if (cover) {
    cover.addEventListener('load', syncQueueCardHeight);
  }
});


