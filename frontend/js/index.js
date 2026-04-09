const renderSongCard = (song) => `
  <article class="song-card glass song-card-interactive" onclick="openPlayer('${song._id}')">
    <div class="cover-wrap">
      <img class="song-cover" src="${song.imagePath}" alt="${song.title}" />
      <button class="btn btn-primary play-overlay-btn" onclick="event.stopPropagation(); playInMini && playInMini('${song._id}')">Play</button>
    </div>
    <div class="song-body">
      <h4>${song.title}</h4>
      <p class="song-meta">${song.artist}</p>
      <div class="song-card-footer">
        <small class="muted">${categoryLabel(song.category)}</small>
        <span class="song-open-hint">Open</span>
      </div>
    </div>
  </article>`;

const renderSearchResultItem = (song) => `
  <article class="search-result-item" onclick="openPlayer('${song._id}')">
    <img class="search-result-cover" src="${song.imagePath}" alt="${song.title}" />
    <div class="search-result-copy">
      <strong>${song.title}</strong>
      <span>${song.artist}</span>
      <small>${categoryLabel(song.category)}</small>
    </div>
    <div class="search-result-actions">
      <button class="btn btn-primary search-result-play" onclick="event.stopPropagation(); playInMini && playInMini('${song._id}')">Play</button>
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

const renderSearchResults = (songs, query = '') => {
  const section = document.getElementById('searchResultsSection');
  const meta = document.getElementById('searchResultsMeta');
  const grid = document.getElementById('searchResultsGrid');
  if (!section || !meta || !grid) return;

  const trimmed = query.trim();
  if (!trimmed) {
    section.classList.add('hidden-search-results');
    grid.innerHTML = '';
    meta.textContent = 'Type a song or artist name to search.';
    return;
  }

  section.classList.remove('hidden-search-results');
  meta.textContent = songs.length
    ? `${songs.length} result${songs.length === 1 ? '' : 's'} found for "${trimmed}"`
    : `No results found for "${trimmed}"`;
  grid.innerHTML = songs.length
    ? songs.map(renderSearchResultItem).join('')
    : '<p class="muted search-results-empty">Try another song title or artist name.</p>';
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
    source.push({ image: song.imagePath, label: categoryLabel(song.category), id: song._id, title: song.title });
  }

  track.innerHTML = source
    .map((item) => {
      const clickAction = `openPlayer('${item.id}')`;
      return `
      <div class="carousel-item glass" onclick="${clickAction}">
        <img src="${item.image}" alt="${item.label}"/>
        <div class="carousel-caption">
          <strong>${item.title}</strong>
          <span>${item.label}</span>
        </div>
      </div>`;
    })
    .join('');
};

const loadHomepage = async (search = '') => {
  showLoader(true);
  try {
    const [allSongsRes, recentRes, searchRes] = await Promise.all([
      fetch(`${API_BASE}/api/songs`),
      fetch(`${API_BASE}/api/songs/recent`),
      search.trim() ? fetch(`${API_BASE}/api/songs?search=${encodeURIComponent(search.trim())}`) : Promise.resolve(null),
    ]);

    const allSongsData = await allSongsRes.json();
    const recentData = await recentRes.json();
    const searchData = searchRes ? await searchRes.json() : { songs: [] };

    const songs = allSongsData.songs || [];
    const recentSongs = recentData.songs || [];
    const searchSongs = searchData.songs || [];

    renderCarousel(songs);
    renderCategorySection('Trending / Latest', songs.filter((s) => s.category === 'trending_latest'), 'trendingGrid');
    renderCategorySection('Sound Check', songs.filter((s) => s.category === 'sound_check'), 'soundGrid');
    renderCategorySection('Private Track', songs.filter((s) => s.category === 'private_track'), 'privateGrid');
    renderCategorySection('Drop', songs.filter((s) => s.category === 'drop'), 'dropGrid');
    renderCategorySection('Bhajan Mix', songs.filter((s) => s.category === 'bhajan_mix'), 'bhajanGrid');
    renderSearchResults(searchSongs, search);

    const recentRoot = document.getElementById('recentGrid');
    recentRoot.innerHTML = recentSongs.map(renderSongCard).join('') || '<p class="muted">No recent uploads.</p>';
  } catch (error) {
    console.error(error);
  } finally {
    showLoader(false);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  const heroVideo = document.querySelector('.xodi-hero-video');
  if (heroVideo) {
    heroVideo.muted = true;
    heroVideo.loop = true;
    heroVideo.autoplay = true;
    heroVideo.playsInline = true;

    const ensurePlay = () => {
      const p = heroVideo.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };

    heroVideo.addEventListener('canplay', ensurePlay, { once: true });
    heroVideo.addEventListener('ended', () => {
      heroVideo.currentTime = 0;
      ensurePlay();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && heroVideo.paused) ensurePlay();
    });

    ensurePlay();
  }
  loadHomepage();

  const searchInput = document.getElementById('searchSong');
  const searchBtn = document.getElementById('searchBtn');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => loadHomepage(searchInput.value.trim()));
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        loadHomepage(searchInput.value.trim());
      }
    });
  }

  if (clearSearchBtn && searchInput) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      loadHomepage('');
    });
  }

  const cta = document.getElementById('ctaCreate');
  if (cta) cta.addEventListener('click', () => (window.location.href = '/login.html'));
});


