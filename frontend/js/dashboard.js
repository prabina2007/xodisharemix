const mustBeLoggedIn = () => {
  const token = localStorage.getItem('xodiToken');
  if (!token) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
};

const DEFAULT_PREVIEW = '/assets/logo.jpg';

const renderDashboardSummary = (songs) => {
  const songCount = songs.length;
  const creatorCount = new Set(songs.map((song) => song.artist?.trim()).filter(Boolean)).size;
  const dashSongCount = document.getElementById('dashSongCount');
  const dashCreatorCount = document.getElementById('dashCreatorCount');
  const recentRoot = document.getElementById('dashboardRecentList');

  if (dashSongCount) dashSongCount.textContent = String(songCount);
  if (dashCreatorCount) dashCreatorCount.textContent = String(creatorCount);

  if (recentRoot) {
    recentRoot.innerHTML = songs.length
      ? songs.slice(0, 8).map((song) => `
          <article class="dashboard-recent-item">
            <img src="${song.imagePath || DEFAULT_PREVIEW}" alt="${song.title}" />
            <div>
              <strong>${song.title}</strong>
              <span>${song.artist}</span>
              <small>${categoryLabel(song.category)}</small>
            </div>
          </article>`).join('')
      : '<p class="muted">No uploads yet.</p>';
  }
};

const loadDashboardSongs = async () => {
  const res = await fetch(`${API_BASE}/api/songs`, { headers: withAuth() });
  const data = await res.json();
  const songs = data.songs || [];
  renderDashboardSummary(songs);
};

const setImageHint = (text, isError = false) => {
  const hint = document.getElementById('imageAutofillHint');
  if (!hint) return;
  hint.textContent = text;
  hint.style.color = isError ? 'var(--danger)' : 'var(--muted)';
};

const setCoverPreview = ({ src = DEFAULT_PREVIEW, title = 'Song cover preview', text = 'Embedded cover art or a manually selected image will appear here before upload.' } = {}) => {
  const preview = document.getElementById('coverPreview');
  const previewTitle = document.getElementById('coverPreviewTitle');
  const previewText = document.getElementById('coverPreviewText');
  if (preview) preview.src = src;
  if (previewTitle) previewTitle.textContent = title;
  if (previewText) previewText.textContent = text;
};

const readFileAsDataUrl = (file) => new Promise((resolve) => {
  if (!file) {
    resolve(null);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => resolve(null);
  reader.readAsDataURL(file);
});

const setImageInputFile = (input, file) => {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
};

const extractEmbeddedCover = (songFile) => new Promise((resolve) => {
  if (!songFile || !window.jsmediatags) {
    resolve(null);
    return;
  }

  window.jsmediatags.read(songFile, {
    onSuccess: (tag) => {
      const picture = tag?.tags?.picture;
      if (!picture?.data || !picture?.format) {
        resolve(null);
        return;
      }

      const byteArray = new Uint8Array(picture.data);
      const blob = new Blob([byteArray], { type: picture.format });
      const extension = picture.format.split('/')[1] || 'jpg';
      const baseName = songFile.name.replace(/\.[^/.]+$/, '');
      const coverFile = new File([blob], `${baseName}-cover.${extension}`, { type: picture.format });
      resolve(coverFile);
    },
    onError: () => resolve(null),
  });
});

window.addEventListener('DOMContentLoaded', () => {
  if (!mustBeLoggedIn()) return;

  const form = document.getElementById('uploadForm');
  const msg = document.getElementById('messageBox');
  const songInput = document.getElementById('songFileInput');
  const imageInput = document.getElementById('songImageInput');
  const titleInput = form.querySelector('input[name="title"]');
  const submitBtn = form.querySelector('button[type="submit"]');

  loadDashboardSongs();
  setCoverPreview();

  imageInput.addEventListener('change', async () => {
    const file = imageInput.files && imageInput.files[0];
    if (!file) {
      setCoverPreview();
      return;
    }
    const previewUrl = await readFileAsDataUrl(file);
    if (previewUrl) {
      setCoverPreview({
        src: previewUrl,
        title: 'Manual image selected',
        text: 'This image will be used as the song cover when you upload the remix.',
      });
    }
  });

  songInput.addEventListener('change', async () => {
    const file = songInput.files && songInput.files[0];
    if (!file) return;

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    if (!titleInput.value.trim()) {
      titleInput.value = baseName;
    }

    setImageHint('Checking song for embedded cover art...');
    const coverFile = await extractEmbeddedCover(file);

    if (coverFile) {
      setImageInputFile(imageInput, coverFile);
      const previewUrl = await readFileAsDataUrl(coverFile);
      setCoverPreview({
        src: previewUrl || DEFAULT_PREVIEW,
        title: 'Embedded cover detected',
        text: 'Cover art from the selected audio file has been attached automatically.',
      });
      setImageHint('Embedded cover art found and selected automatically.');
      return;
    }

    imageInput.value = '';
    setCoverPreview({
      src: DEFAULT_PREVIEW,
      title: 'No embedded cover found',
      text: 'This song does not include built-in cover art. You can upload an image manually if you want.',
    });
    setImageHint('No embedded cover art found. You can upload a song image manually.');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const original = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    const res = await fetch(`${API_BASE}/api/songs/upload`, {
      method: 'POST',
      headers: withAuth(),
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.message || 'Upload failed';
      msg.style.color = 'var(--danger)';
      submitBtn.disabled = false;
      submitBtn.textContent = original;
      return;
    }

    msg.textContent = 'Song uploaded and published successfully';
    msg.style.color = 'var(--accent)';
    form.reset();
    setCoverPreview();
    setImageHint('If the song file has embedded cover art, it will be used automatically. Otherwise you can upload an image manually.');
    submitBtn.disabled = false;
    submitBtn.textContent = original;
    loadDashboardSongs();
  });

  const logout = document.getElementById('logoutBtn');
  logout.addEventListener('click', () => {
    localStorage.removeItem('xodiToken');
    window.location.href = '/login.html';
  });
});
