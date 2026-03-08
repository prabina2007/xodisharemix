let queue = [];
let currentIndex = 0;
let audio;

const params = new URLSearchParams(window.location.search);
const songId = params.get('id');

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const renderQueue = () => {
  const root = document.getElementById('queueList');
  root.innerHTML = queue
    .map((song, idx) => `<div class="queue-item ${idx === currentIndex ? 'active' : ''}" onclick="playIndex(${idx})"><strong>${idx + 1}. ${song.title}</strong><br/><small class="muted">${song.artist}</small></div>`)
    .join('');
};

const loadSong = (song) => {
  document.getElementById('songCover').src = song.imagePath;
  document.getElementById('songTitle').textContent = song.title;
  document.getElementById('songArtist').textContent = song.artist;
  document.getElementById('downloadBtn').href = `${API_BASE}/api/songs/${song._id}/download`;
  document.getElementById('downloadBtn').setAttribute('download', song.title);

  document.getElementById('currentTime').textContent = '0:00';
  document.getElementById('totalTime').textContent = '0:00';

  audio.src = song.songPath;
  audio.play();
  renderQueue();
};

const playIndex = (idx) => {
  currentIndex = idx;
  loadSong(queue[currentIndex]);
};

window.addEventListener('DOMContentLoaded', async () => {
  audio = document.getElementById('audioPlayer');

  const allRes = await fetch(`${API_BASE}/api/songs`);
  const allData = await allRes.json();
  queue = allData.songs || [];

  if (!queue.length) return;

  if (songId) {
    const found = queue.findIndex((s) => s._id === songId);
    currentIndex = found >= 0 ? found : 0;
  }

  loadSong(queue[currentIndex]);

  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const progress = document.getElementById('progressBar');
  const volume = document.getElementById('volumeBar');
  const currentTime = document.getElementById('currentTime');
  const totalTime = document.getElementById('totalTime');

  playBtn.addEventListener('click', () => audio.play());
  pauseBtn.addEventListener('click', () => audio.pause());
  nextBtn.addEventListener('click', () => playIndex((currentIndex + 1) % queue.length));
  prevBtn.addEventListener('click', () => playIndex((currentIndex - 1 + queue.length) % queue.length));

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
    audio.volume = volume.value;
  });

  audio.addEventListener('ended', () => nextBtn.click());
  renderQueue();
});
