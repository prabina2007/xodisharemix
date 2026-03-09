const mustBeLoggedIn = () => {
  const token = localStorage.getItem('xodiToken');
  if (!token) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
};

const loadDashboardSongs = async () => {
  const root = document.getElementById('dashboardSongs');
  const res = await fetch(`${API_BASE}/api/songs`, { headers: withAuth() });
  const data = await res.json();
  const songs = data.songs || [];
  root.innerHTML = songs.length
    ? songs.map((song) => `<article class="song-card glass"><img class="song-cover" src="${song.imagePath}" alt="${song.title}"/><div class="song-body"><h4>${song.title}</h4><p class="song-meta">${song.artist}</p><small class="muted">${categoryLabel(song.category)}</small></div></article>`).join('')
    : '<p class="muted">No uploaded songs yet.</p>';
};

window.addEventListener('DOMContentLoaded', () => {
  if (!mustBeLoggedIn()) return;

  const form = document.getElementById('uploadForm');
  const msg = document.getElementById('messageBox');
  const songInput = form.querySelector('input[name="song"]');
  const titleInput = form.querySelector('input[name="title"]');

  loadDashboardSongs();

  songInput.addEventListener('change', () => {
    const file = songInput.files && songInput.files[0];
    if (!file) return;

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    if (!titleInput.value.trim()) {
      titleInput.value = baseName;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const res = await fetch(`${API_BASE}/api/songs/upload`, {
      method: 'POST',
      headers: withAuth(),
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.message || 'Upload failed';
      msg.style.color = 'var(--danger)';
      return;
    }

    msg.textContent = 'Song uploaded and published successfully';
    msg.style.color = 'var(--accent)';
    form.reset();
    loadDashboardSongs();
  });

  const logout = document.getElementById('logoutBtn');
  logout.addEventListener('click', () => {
    localStorage.removeItem('xodiToken');
    window.location.href = '/login.html';
  });
});
