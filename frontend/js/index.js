const renderSongCard = (song) => `
  <article class="song-card glass">
    <div class="cover-wrap">
      <img class="song-cover" src="${song.imagePath}" alt="${song.title}" />
      <button class="btn btn-primary play-overlay-btn" onclick="playInMini && playInMini('${song._id}')">Play</button>
    </div>
    <div class="song-body">
      <h4>${song.title}</h4>
      <p class="song-meta">${song.artist}</p>
      <div class="row">
        <small class="muted">${categoryLabel(song.category)}</small>
      </div>
    </div>
  </article>`;

const openPlayer = (id) => {
  window.location.href = `/player.html?id=${id}`;
};

const renderCategorySection = (label, songs, containerId) => {
  const root = document.getElementById(containerId);
  if (!root) return;
  root.innerHTML = songs.length
    ? songs.map(renderSongCard).join('')
    : `<p class="muted">No songs in ${label} yet.</p>`;
};

const renderCarousel = (songs) => {
  const track = document.getElementById('carouselTrack');
  if (!track) return;

  const trendingSongs = songs.filter((s) => s.category === 'trending_latest');
  const base = trendingSongs.length ? trendingSongs : songs;

  if (!base.length) {
    track.innerHTML = '';
    return;
  }

  const source = [];
  while (source.length < 9) {
    const song = base[source.length % base.length];
    source.push({ image: song.imagePath, label: categoryLabel(song.category), id: song._id });
  }

  track.innerHTML = source
    .map((item) => {
      const clickAction = `openPlayer('${item.id}')`;
      return `
      <div class="carousel-item glass" onclick="${clickAction}">
        <img src="${item.image}" alt="${item.label}"/>
        <span>${item.label}</span>
      </div>`;
    })
    .join('');
};

const loadHomepage = async (search = '') => {
  showLoader(true);
  try {
    const res = await fetch(`${API_BASE}/api/songs${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    const data = await res.json();
    const songs = data.songs || [];

    renderCarousel(songs);
    renderCategorySection('Trending / Latest', songs.filter((s) => s.category === 'trending_latest'), 'trendingGrid');
    renderCategorySection('Sound Check', songs.filter((s) => s.category === 'sound_check'), 'soundGrid');
    renderCategorySection('Private Track', songs.filter((s) => s.category === 'private_track'), 'privateGrid');
    renderCategorySection('Bhajan Mix', songs.filter((s) => s.category === 'bhajan_mix'), 'bhajanGrid');

    const recentRoot = document.getElementById('recentGrid');
    const recentRes = await fetch(`${API_BASE}/api/songs/recent`);
    const recentData = await recentRes.json();
    recentRoot.innerHTML = (recentData.songs || []).map(renderSongCard).join('') || '<p class="muted">No recent uploads.</p>';
  } catch (error) {
    console.error(error);
  } finally {
    showLoader(false);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  loadHomepage();

  const searchInput = document.getElementById('searchSong');
  const searchBtn = document.getElementById('searchBtn');

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => loadHomepage(searchInput.value.trim()));
  }

  const cta = document.getElementById('ctaCreate');
  if (cta) cta.addEventListener('click', () => (window.location.href = '/login.html'));
});
