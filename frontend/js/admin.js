let adminUsers = [];
let adminSongs = [];

const adminAuthGuard = () => {
  if (!localStorage.getItem('xodiAdminToken')) {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('adminLoginBox').style.display = 'grid';
  } else {
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('adminLoginBox').style.display = 'none';
    loadAdminData();
  }
};

const adminHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('xodiAdminToken')}` });
const getAdminSearch = () => document.getElementById('adminSearchInput')?.value.trim().toLowerCase() || '';
const getAdminCategory = () => document.getElementById('adminCategoryFilter')?.value || 'all';

const filterUsers = () => {
  const search = getAdminSearch();
  return adminUsers.filter((user) => {
    if (!search) return true;
    const haystack = [user.email, user.isVerified ? 'verified' : 'pending', formatDate(user.createdAt)].join(' ').toLowerCase();
    return haystack.includes(search);
  });
};

const filterSongs = () => {
  const search = getAdminSearch();
  const category = getAdminCategory();

  return adminSongs.filter((song) => {
    const categoryMatch = category === 'all' || song.category === category;
    if (!categoryMatch) return false;
    if (!search) return true;
    const haystack = [song.title, song.artist, song.uploader?.email || '', categoryLabel(song.category)].join(' ').toLowerCase();
    return haystack.includes(search);
  });
};

const renderAdminData = () => {
  const users = filterUsers();
  const songs = filterSongs();

  document.getElementById('usersBody').innerHTML = users.length
    ? users.map((u) => `<tr><td>${u.email}</td><td><span class="admin-tag ${u.isVerified ? 'verified' : 'pending'}">${u.isVerified ? 'Verified' : 'Pending'}</span></td><td>${formatDate(u.createdAt)}</td><td><button class="admin-action-btn" onclick="deleteUser('${u._id}')">Delete</button></td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">No users found.</td></tr>';

  document.getElementById('songsBody').innerHTML = songs.length
    ? songs.map((s) => `<tr><td>${s.title}</td><td>${s.artist}</td><td><span class="admin-tag">${categoryLabel(s.category)}</span></td><td>${s.uploader?.email || 'Unknown'}</td><td><button class="admin-action-btn" onclick="deleteSong('${s._id}')">Delete</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="muted">No songs found.</td></tr>';

  const verifiedUsers = adminUsers.filter((u) => u.isVerified).length;
  const recentSongs = adminSongs.filter((s) => new Date(s.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;

  document.getElementById('userCount').textContent = String(adminUsers.length);
  document.getElementById('verifiedCount').textContent = String(verifiedUsers);
  document.getElementById('songCount').textContent = String(adminSongs.length);
  document.getElementById('recentSongCount').textContent = String(recentSongs);
  document.getElementById('adminUsersMeta').textContent = `${users.length} entries`;
  document.getElementById('adminSongsMeta').textContent = `${songs.length} entries`;
  document.getElementById('adminVisibleUsers').textContent = String(users.length);
  document.getElementById('adminVisibleSongs').textContent = String(songs.length);
  document.getElementById('adminLastRefresh').textContent = new Date().toLocaleString();
  document.getElementById('adminSidebarMeta').textContent = `${adminUsers.length} users | ${adminSongs.length} songs`;
};

const wireAdminNav = () => {
  const links = Array.from(document.querySelectorAll('.admin-nav-link'));
  links.forEach((link) => {
    link.addEventListener('click', () => {
      links.forEach((x) => x.classList.remove('active'));
      link.classList.add('active');
    });
  });
};

const loadAdminData = async () => {
  const usersRes = await fetch(`${API_BASE}/api/admin/users`, { headers: adminHeaders() });
  const songsRes = await fetch(`${API_BASE}/api/admin/songs`, { headers: adminHeaders() });
  const usersData = await usersRes.json();
  const songsData = await songsRes.json();
  adminUsers = usersData.users || [];
  adminSongs = songsData.songs || [];
  renderAdminData();
};

const deleteUser = async (id) => {
  await fetch(`${API_BASE}/api/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders() });
  loadAdminData();
};

const deleteSong = async (id) => {
  await fetch(`${API_BASE}/api/admin/songs/${id}`, { method: 'DELETE', headers: adminHeaders() });
  loadAdminData();
};

window.deleteUser = deleteUser;
window.deleteSong = deleteSong;

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;

    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.message || 'Admin login failed');
      return;
    }

    localStorage.setItem('xodiAdminToken', data.token);
    adminAuthGuard();
  });

  document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('xodiAdminToken');
    adminAuthGuard();
  });

  document.getElementById('adminSearchInput')?.addEventListener('input', renderAdminData);
  document.getElementById('adminCategoryFilter')?.addEventListener('change', renderAdminData);
  document.getElementById('adminRefreshBtn')?.addEventListener('click', loadAdminData);

  wireAdminNav();
  adminAuthGuard();
});
