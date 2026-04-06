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
    elements: {},
  },
};

const deckMixWeight = (deckKey) => {
  if (deckKey === 'A') return 1 - crossfaderValue;
  return crossfaderValue;
};

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const setDeckButtonLabel = (deck) => {
  if (!deck.elements.playBtn || !deck.audio) return;
  deck.elements.playBtn.textContent = deck.audio.paused ? 'Play' : 'Pause';
};

const updateQueueBadge = () => {
  const badge = document.getElementById('queueCountBadge');
  if (badge) badge.textContent = `${queue.length} song${queue.length === 1 ? '' : 's'}`;
};

const updateDeckReadout = (deck) => {
  const { song, elements, audio, rate } = deck;
  elements.cover.src = resolveMediaUrl(song?.imagePath || '/assets/logo.jpg');
  elements.title.textContent = song?.title || `Load a song to Deck ${deck.key}`;
  elements.artist.textContent = song?.artist || (deck.key === 'A' ? 'Choose any recent upload below.' : 'Mix a second track when you are ready.');
  elements.category.textContent = song ? categoryLabel(song.category) : 'No track';
  elements.download.href = song ? `${API_BASE}/api/songs/${song._id}/download` : '#';
  elements.download.setAttribute('download', song?.title || '');
  const current = audio ? formatTime(audio.currentTime) : '0:00';
  const total = audio ? formatTime(audio.duration) : '0:00';
  elements.time.textContent = `${current} / ${total}`;
  elements.rateLabel.textContent = `Tempo ${Math.round(rate * 100)}%`;
  elements.seek.value = audio?.duration ? String((audio.currentTime / audio.duration) * 100) : '0';
  elements.volume.value = String(deck.volume);
  elements.rate.value = String(rate);
  setDeckButtonLabel(deck);
};

const updateMixerGains = () => {
  if (!mixerReady) return;
  ['A', 'B'].forEach((key) => {
    const deck = deckState[key];
    if (!deck.gainNode) return;
    deck.gainNode.gain.value = deck.volume * deckMixWeight(key) * masterVolume;
  });
};

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
  const deckALevel = document.getElementById('deckALevel');
  const deckBLevel = document.getElementById('deckBLevel');
  const masterLevel = document.getElementById('masterLevel');
  const data = {
    A: new Uint8Array(deckState.A.analyser.frequencyBinCount),
    B: new Uint8Array(deckState.B.analyser.frequencyBinCount),
  };

  const draw = () => {
    ['A', 'B'].forEach((key) => {
      deckState[key].analyser.getByteFrequencyData(data[key]);
    });

    const avgA = data.A.reduce((sum, v) => sum + v, 0) / data.A.length / 255;
    const avgB = data.B.reduce((sum, v) => sum + v, 0) / data.B.length / 255;
    if (deckALevel) deckALevel.style.height = `${Math.max(6, avgA * 100)}%`;
    if (deckBLevel) deckBLevel.style.height = `${Math.max(6, avgB * 100)}%`;
    if (masterLevel) masterLevel.style.height = `${Math.max(6, ((avgA + avgB) / 2) * 100)}%`;
    meterFrame = requestAnimationFrame(draw);
  };

  if (meterFrame) cancelAnimationFrame(meterFrame);
  draw();
};

const loadDeck = async (deckKey, song, autoplay = false) => {
  const deck = deckState[deckKey];
  if (!deck || !song) return;

  deck.song = song;
  deck.audio.src = resolveMediaUrl(song.songPath);
  deck.audio.currentTime = 0;
  deck.audio.playbackRate = deck.rate;
  updateDeckReadout(deck);
  updateMixerGains();

  if (autoplay) {
    await ensureMixerResumed();
    try { await deck.audio.play(); } catch (_error) {}
    setDeckButtonLabel(deck);
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
};

const cueDeck = (deckKey) => {
  const deck = deckState[deckKey];
  if (!deck.song) return;
  deck.audio.pause();
  deck.audio.currentTime = 0;
  updateDeckReadout(deck);
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
          <button class="btn btn-primary dj-library-btn" onclick="loadSongToDeck('A', '${song._id}', true)">Load A</button>
          <button class="btn btn-ghost dj-library-btn" onclick="loadSongToDeck('B', '${song._id}', true)">Load B</button>
          <button class="btn btn-ghost dj-library-btn" onclick="addSongToQueue('${song._id}')">Add Queue</button>
        </div>
      </div>
    </article>
  `).join('');
};

const syncDeckTempos = () => {
  const reference = deckState.A.song ? deckState.A.rate : deckState.B.rate;
  ['A', 'B'].forEach((key) => {
    const deck = deckState[key];
    deck.rate = reference;
    deck.audio.playbackRate = reference;
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
  elements.rate.addEventListener('input', () => {
    deck.rate = Number(elements.rate.value);
    audio.playbackRate = deck.rate;
    updateDeckReadout(deck);
  });

  audio.addEventListener('loadedmetadata', () => updateDeckReadout(deck));
  audio.addEventListener('timeupdate', () => updateDeckReadout(deck));
  audio.addEventListener('play', () => setDeckButtonLabel(deck));
  audio.addEventListener('pause', () => setDeckButtonLabel(deck));
  audio.addEventListener('ended', () => setDeckButtonLabel(deck));
};

window.loadSongToDeck = async (deckKey, songId, autoplay = false) => {
  const song = librarySongs.find((item) => item._id === songId) || queue.find((item) => item._id === songId);
  if (!song) return;
  await loadDeck(deckKey, song, autoplay);
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
      rateLabel: document.getElementById(`deck${key}RateLabel`),
      seek: document.getElementById(`deck${key}Seek`),
      volume: document.getElementById(`deck${key}Volume`),
      rate: document.getElementById(`deck${key}Rate`),
      playBtn: document.getElementById(`deck${key}Play`),
      cueBtn: document.getElementById(`deck${key}Cue`),
      download: document.getElementById(`deck${key}Download`),
    };
    bindDeckEvents(key);
    updateDeckReadout(deckState[key]);
  });

  document.getElementById('crossfader').addEventListener('input', (event) => {
    crossfaderValue = Number(event.target.value) / 100;
    updateMixerGains();
  });
  document.getElementById('masterVolume').addEventListener('input', (event) => {
    masterVolume = Number(event.target.value);
    updateMixerGains();
  });
  document.getElementById('syncDecksBtn').addEventListener('click', syncDeckTempos);
  document.getElementById('clearQueueBtn').addEventListener('click', clearQueue);
  document.getElementById('queueToDeckABtn').addEventListener('click', () => loadQueueTopToDeck('A'));
  document.getElementById('queueToDeckBBtn').addEventListener('click', () => loadQueueTopToDeck('B'));

  try {
    const res = await fetch(`${API_BASE}/api/songs`);
    const data = await res.json();
    librarySongs.push(...((data.songs || []).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))));
    renderLibrary();
    renderQueue();

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
