const params = new URLSearchParams(window.location.search);
const initialSongId = params.get('id');

const librarySongs = [];
const queue = [];
let masterVolume = 1;
let crossfaderValue = 0.5;
let audioContext;
let mixerReady = false;
let masterGain;
let meterFrame;
let crossfadeBusy = false;

const getSongBaseBpm = (song) => {
  const value = Number(song?.bpm);
  return Number.isFinite(value) && value > 0 ? value : 120;
};

const deckState = {
  A: {
    key: 'A',
    song: null,
    audio: null,
    source: null,
    gainNode: null,
    analyser: null,
    volume: 1,
    rate: 1,
    baseBpm: 120,
    currentBpm: 120,
    elements: {},
  },
  B: {
    key: 'B',
    song: null,
    audio: null,
    source: null,
    gainNode: null,
    analyser: null,
    volume: 1,
    rate: 1,
    baseBpm: 120,
    currentBpm: 120,
    elements: {},
  },
};

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const deckMixWeight = (deckKey) => (deckKey === 'A' ? 1 - crossfaderValue : crossfaderValue);

const setDeckButtonLabel = (deck) => {
  if (!deck.elements.playBtn || !deck.audio) return;
  deck.elements.playBtn.textContent = deck.audio.paused ? 'Play' : 'Pause';
};

const setMasterPlayPauseLabel = () => {
  const btn = document.getElementById('masterPlayPauseBtn');
  if (!btn) return;
  const playableDecks = ['A', 'B'].map((key) => deckState[key]).filter((deck) => deck.song);
  if (!playableDecks.length) {
    btn.textContent = 'Master Play';
    return;
  }
  btn.textContent = playableDecks.some((deck) => !deck.audio.paused) ? 'Master Pause' : 'Master Play';
};

const updateQueueBadge = () => {
  const badge = document.getElementById('queueCountBadge');
  if (badge) badge.textContent = `${queue.length} song${queue.length === 1 ? '' : 's'}`;
};

const updateDeckReadout = (deck) => {
  const { song, elements, audio } = deck;
  elements.cover.src = resolveMediaUrl(song?.imagePath || '/assets/logo.jpg');
  elements.title.textContent = song?.title || `Load a song to Deck ${deck.key}`;
  elements.artist.textContent = song?.artist || (deck.key === 'A'
    ? 'Choose any recent upload below.'
    : 'Mix a second track when you are ready.');
  elements.category.textContent = song ? categoryLabel(song.category) : 'No track';
  elements.download.href = song ? `${API_BASE}/api/songs/${song._id}/download` : '#';
  elements.download.setAttribute('download', song?.title || '');
  elements.time.textContent = `${formatTime(audio?.currentTime || 0)} / ${formatTime(audio?.duration || 0)}`;
  elements.bpmLabel.textContent = `BPM ${Math.round(deck.currentBpm)}`;
  elements.seek.value = audio?.duration ? String((audio.currentTime / audio.duration) * 100) : '0';
  elements.volume.value = String(deck.volume);
  elements.bpm.value = String(Math.round(deck.currentBpm));
  setDeckButtonLabel(deck);
  setMasterPlayPauseLabel();
};

const updateMixerGains = () => {
  if (!mixerReady) return;
  ['A', 'B'].forEach((key) => {
    const deck = deckState[key];
    if (!deck.gainNode) return;
    deck.gainNode.gain.value = deck.volume * deckMixWeight(key) * masterVolume;
  });
};

const setCrossfaderUi = (value) => {
  crossfaderValue = Math.max(0, Math.min(1, value));
  const control = document.getElementById('crossfader');
  if (control) control.value = String(Math.round(crossfaderValue * 100));
  updateMixerGains();
};

const animateCrossfaderTo = (target, duration = 900) => new Promise((resolve) => {
  const start = crossfaderValue;
  const startedAt = performance.now();
  const frame = (time) => {
    const progress = Math.min(1, (time - startedAt) / duration);
    const eased = 1 - ((1 - progress) ** 3);
    setCrossfaderUi(start + ((target - start) * eased));
    if (progress < 1) requestAnimationFrame(frame);
    else resolve();
  };
  requestAnimationFrame(frame);
});

const initMixer = () => {
  if (mixerReady || !window.AudioContext) return;
  audioContext = new window.AudioContext();
  masterGain = audioContext.createGain();
  masterGain.connect(audioContext.destination);

  ['A', 'B'].forEach((key) => {
    const deck = deckState[key];
    deck.source = audioContext.createMediaElementSource(deck.audio);
    deck.gainNode = audioContext.createGain();
    deck.analyser = audioContext.createAnalyser();
    deck.analyser.fftSize = 128;
    deck.source.connect(deck.gainNode);
    deck.gainNode.connect(deck.analyser);
    deck.analyser.connect(masterGain);
  });

  mixerReady = true;
  updateMixerGains();
  startMixerMeters();
};

const ensureMixerResumed = async () => {
  initMixer();
  if (audioContext && audioContext.state === 'suspended') {
    try { await audioContext.resume(); } catch (_error) {}
  }
};

const startMixerMeters = () => {
  if (!mixerReady) return;
  const levelEls = {
    A: document.getElementById('deckALevel'),
    B: document.getElementById('deckBLevel'),
    M: document.getElementById('masterLevel'),
  };
  const dataA = new Uint8Array(deckState.A.analyser.frequencyBinCount);
  const dataB = new Uint8Array(deckState.B.analyser.frequencyBinCount);
  const isMobile = () => window.matchMedia('(max-width: 780px)').matches;
  const setMeter = (el, amount) => {
    if (!el) return;
    if (isMobile()) {
      el.style.width = `${Math.max(8, amount * 100)}%`;
      el.style.height = '100%';
    } else {
      el.style.height = `${Math.max(8, amount * 100)}%`;
      el.style.width = '100%';
    }
  };

  const draw = () => {
    deckState.A.analyser.getByteFrequencyData(dataA);
    deckState.B.analyser.getByteFrequencyData(dataB);
    const avgA = dataA.reduce((sum, value) => sum + value, 0) / dataA.length / 255;
    const avgB = dataB.reduce((sum, value) => sum + value, 0) / dataB.length / 255;
    setMeter(levelEls.A, avgA);
    setMeter(levelEls.B, avgB);
    setMeter(levelEls.M, (avgA + avgB) / 2);
    meterFrame = requestAnimationFrame(draw);
  };

  if (meterFrame) cancelAnimationFrame(meterFrame);
  draw();
};

const loadDeck = async (deckKey, song, autoplay = false) => {
  const deck = deckState[deckKey];
  if (!deck || !song) return;

  deck.song = song;
  deck.baseBpm = getSongBaseBpm(song);
  deck.currentBpm = deck.baseBpm;
  deck.rate = 1;
  deck.audio.pause();
  deck.audio.src = resolveMediaUrl(song.songPath);
  deck.audio.currentTime = 0;
  deck.audio.playbackRate = deck.rate;
  updateDeckReadout(deck);
  updateMixerGains();

  if (autoplay) {
    await ensureMixerResumed();
    try { await deck.audio.play(); } catch (_error) {}
    setDeckButtonLabel(deck);
    setMasterPlayPauseLabel();
  }
};

const toggleDeckPlayback = async (deckKey) => {
  const deck = deckState[deckKey];
  if (!deck.song) return;
  await ensureMixerResumed();
  if (deck.audio.paused) {
    try { await deck.audio.play(); } catch (_error) {}
  } else {
    deck.audio.pause();
  }
  setDeckButtonLabel(deck);
  setMasterPlayPauseLabel();
};

const cueDeck = (deckKey) => {
  const deck = deckState[deckKey];
  if (!deck.song) return;
  deck.audio.pause();
  deck.audio.currentTime = 0;
  updateDeckReadout(deck);
};

const toggleMasterPlayback = async () => {
  const playableDecks = ['A', 'B'].map((key) => deckState[key]).filter((deck) => deck.song);
  if (!playableDecks.length) return;
  await ensureMixerResumed();
  const anyPlaying = playableDecks.some((deck) => !deck.audio.paused);

  if (anyPlaying) {
    playableDecks.forEach((deck) => deck.audio.pause());
  } else {
    await Promise.all(playableDecks.map(async (deck) => {
      try { await deck.audio.play(); } catch (_error) {}
    }));
  }

  playableDecks.forEach(updateDeckReadout);
  setMasterPlayPauseLabel();
};

const smoothSwitchDeck = async () => {
  if (crossfadeBusy) return;
  const fromKey = crossfaderValue <= 0.5 ? 'A' : 'B';
  const toKey = fromKey === 'A' ? 'B' : 'A';
  const fromDeck = deckState[fromKey];
  const toDeck = deckState[toKey];
  if (!toDeck.song) return;

  crossfadeBusy = true;
  await ensureMixerResumed();
  if (toDeck.audio.paused) {
    try { await toDeck.audio.play(); } catch (_error) {}
  }
  await animateCrossfaderTo(toKey === 'A' ? 0 : 1, 950);
  if (!fromDeck.audio.paused) fromDeck.audio.pause();
  updateDeckReadout(fromDeck);
  updateDeckReadout(toDeck);
  crossfadeBusy = false;
};

const addToQueue = (songId) => {
  const song = librarySongs.find((item) => item._id === songId);
  if (!song) return;
  if (!queue.some((item) => item._id === songId)) queue.push(song);
  renderQueue();
};

const removeFromQueue = (songId) => {
  const idx = queue.findIndex((item) => item._id === songId);
  if (idx >= 0) queue.splice(idx, 1);
  renderQueue();
};

const clearQueue = () => {
  queue.length = 0;
  renderQueue();
};

const loadQueueTopToDeck = async (deckKey) => {
  if (!queue.length) return;
  const song = queue.shift();
  renderQueue();
  await loadDeck(deckKey, song, false);
};

const renderQueue = () => {
  const root = document.getElementById('queueList');
  if (!root) return;
  updateQueueBadge();
  if (!queue.length) {
    root.innerHTML = '<div class="dj-empty-state"><strong>Queue is empty</strong><p class="muted">Add tracks from the song library below.</p></div>';
    return;
  }

  root.innerHTML = queue.map((song, index) => `
    <article class="queue-item dj-queue-item">
      <img class="dj-queue-cover" src="${resolveMediaUrl(song.imagePath)}" alt="${song.title}" />
      <div class="dj-queue-copy">
        <strong>${index + 1}. ${song.title}</strong>
        <small class="muted">${song.artist}</small>
      </div>
      <div class="dj-queue-item-actions">
        <button class="btn btn-ghost dj-mini-btn" onclick="event.stopPropagation(); loadSongToDeck('A', '${song._id}')">A</button>
        <button class="btn btn-ghost dj-mini-btn" onclick="event.stopPropagation(); loadSongToDeck('B', '${song._id}')">B</button>
        <button class="btn btn-ghost dj-mini-btn" onclick="event.stopPropagation(); removeSongFromQueue('${song._id}')">Remove</button>
      </div>
    </article>
  `).join('');
};

const renderLibrary = () => {
  const root = document.getElementById('playerRecentGrid');
  if (!root) return;
  if (!librarySongs.length) {
    root.innerHTML = '<p class="muted">No recent uploads yet.</p>';
    return;
  }

  root.innerHTML = librarySongs.map((song) => `
    <article class="song-card glass song-card-interactive player-recent-card dj-library-card">
      <div class="cover-wrap">
        <img class="song-cover" src="${resolveMediaUrl(song.imagePath)}" alt="${song.title}" />
      </div>
      <div class="song-body">
        <h4>${song.title}</h4>
        <p class="song-meta">${song.artist}</p>
        <div class="song-card-footer dj-library-footer">
          <small class="muted">${categoryLabel(song.category)}</small>
          <span class="song-open-hint">Ready to mix</span>
        </div>
        <div class="dj-library-actions">
          <button class="btn btn-primary dj-library-btn" onclick="loadSongToDeck('A', '${song._id}')">Load A</button>
          <button class="btn btn-ghost dj-library-btn" onclick="loadSongToDeck('B', '${song._id}')">Load B</button>
          <button class="btn btn-ghost dj-library-btn" onclick="addSongToQueue('${song._id}')">Add Queue</button>
        </div>
      </div>
    </article>
  `).join('');
};

const syncDeckTempos = () => {
  const referenceDeck = deckState.A.song ? deckState.A : deckState.B;
  ['A', 'B'].forEach((key) => {
    const deck = deckState[key];
    if (!deck.song) return;
    deck.currentBpm = referenceDeck.currentBpm;
    deck.rate = deck.currentBpm / deck.baseBpm;
    deck.audio.playbackRate = deck.rate;
    updateDeckReadout(deck);
  });
};

const bindDeckEvents = (deckKey) => {
  const deck = deckState[deckKey];
  const { audio, elements } = deck;

  elements.playBtn.addEventListener('click', () => toggleDeckPlayback(deckKey));
  elements.cueBtn.addEventListener('click', () => cueDeck(deckKey));
  elements.seek.addEventListener('input', () => {
    if (!audio.duration) return;
    audio.currentTime = (Number(elements.seek.value) / 100) * audio.duration;
    updateDeckReadout(deck);
  });
  elements.volume.addEventListener('input', () => {
    deck.volume = Number(elements.volume.value);
    updateMixerGains();
  });
  elements.bpm.addEventListener('input', () => {
    deck.currentBpm = Number(elements.bpm.value);
    deck.rate = deck.currentBpm / deck.baseBpm;
    audio.playbackRate = deck.rate;
    updateDeckReadout(deck);
  });

  audio.addEventListener('loadedmetadata', () => updateDeckReadout(deck));
  audio.addEventListener('timeupdate', () => updateDeckReadout(deck));
  audio.addEventListener('play', () => {
    setDeckButtonLabel(deck);
    setMasterPlayPauseLabel();
  });
  audio.addEventListener('pause', () => {
    setDeckButtonLabel(deck);
    setMasterPlayPauseLabel();
  });
  audio.addEventListener('ended', () => {
    setDeckButtonLabel(deck);
    setMasterPlayPauseLabel();
  });
};

window.loadSongToDeck = async (deckKey, songId) => {
  const song = librarySongs.find((item) => item._id === songId) || queue.find((item) => item._id === songId);
  if (!song) return;
  await loadDeck(deckKey, song, false);
};
window.addSongToQueue = addToQueue;
window.removeSongFromQueue = removeFromQueue;

window.addEventListener('DOMContentLoaded', async () => {
  showLoader(true);

  deckState.A.audio = document.getElementById('deckAAudio');
  deckState.B.audio = document.getElementById('deckBAudio');

  ['A', 'B'].forEach((key) => {
    deckState[key].elements = {
      cover: document.getElementById(`deck${key}Cover`),
      title: document.getElementById(`deck${key}Title`),
      artist: document.getElementById(`deck${key}Artist`),
      category: document.getElementById(`deck${key}Category`),
      time: document.getElementById(`deck${key}Time`),
      bpmLabel: document.getElementById(`deck${key}BpmLabel`),
      seek: document.getElementById(`deck${key}Seek`),
      volume: document.getElementById(`deck${key}Volume`),
      bpm: document.getElementById(`deck${key}Bpm`),
      playBtn: document.getElementById(`deck${key}Play`),
      cueBtn: document.getElementById(`deck${key}Cue`),
      download: document.getElementById(`deck${key}Download`),
    };
    bindDeckEvents(key);
    updateDeckReadout(deckState[key]);
  });

  document.getElementById('crossfader').addEventListener('input', (event) => {
    setCrossfaderUi(Number(event.target.value) / 100);
  });
  document.getElementById('masterVolume').addEventListener('input', (event) => {
    masterVolume = Number(event.target.value);
    updateMixerGains();
  });
  document.getElementById('syncDecksBtn').addEventListener('click', syncDeckTempos);
  document.getElementById('masterPlayPauseBtn').addEventListener('click', toggleMasterPlayback);
  document.getElementById('clearQueueBtn').addEventListener('click', clearQueue);
  document.getElementById('queueToDeckABtn').addEventListener('click', () => loadQueueTopToDeck('A'));
  document.getElementById('queueToDeckBBtn').addEventListener('click', () => loadQueueTopToDeck('B'));

  try {
    const res = await fetch(`${API_BASE}/api/songs`);
    const data = await res.json();
    librarySongs.push(...((data.songs || []).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))));
    renderLibrary();
    renderQueue();
    setCrossfaderUi(0.5);
    setMasterPlayPauseLabel();

    if (initialSongId) {
      const firstSong = librarySongs.find((song) => song._id === initialSongId);
      if (firstSong) await loadDeck('A', firstSong, false);
    }
  } catch (error) {
    console.error(error);
  } finally {
    showLoader(false);
  }
});

window.addEventListener('keydown', async (event) => {
  if (event.code !== 'Space') return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || document.activeElement?.isContentEditable) return;
  event.preventDefault();
  await smoothSwitchDeck();
});

