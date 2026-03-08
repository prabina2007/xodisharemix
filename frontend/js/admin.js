const adminAuthGuard = () => {
  if (!localStorage.getItem('xodiAdminToken')) {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('adminLoginBox').style.display = 'grid';
  } else {
    document.getElementById('adminPanel').style.display = 'grid';
    document.getElementById('adminLoginBox').style.display = 'none';
    loadAdminData();
  }
};

const adminHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('xodiAdminToken')}` });

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
  const users = usersData.users || [];
  const songs = songsData.songs || [];

  const usersBody = document.getElementById('usersBody');
  usersBody.innerHTML = users
    .map((u) => `<tr><td>${u.email}</td><td><span class="admin-tag ${u.isVerified ? 'verified' : 'pending'}">${u.isVerified ? 'Verified' : 'Pending'}</span></td><td>${formatDate(u.createdAt)}</td><td><button class="admin-action-btn" onclick="deleteUser('${u._id}')">Delete</button></td></tr>`)
    .join('');

  const songsBody = document.getElementById('songsBody');
  songsBody.innerHTML = songs
    .map((s) => `<tr><td>${s.title}</td><td>${s.artist}</td><td><span class="admin-tag">${categoryLabel(s.category)}</span></td><td>${s.uploader?.email || 'Unknown'}</td><td><button class="admin-action-btn" onclick="deleteSong('${s._id}')">Delete</button></td></tr>`)
    .join('');

  const verifiedUsers = users.filter((u) => u.isVerified).length;
  const recentSongs = songs.filter((s) => new Date(s.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
  document.getElementById('userCount').textContent = String(users.length);
  document.getElementById('verifiedCount').textContent = String(verifiedUsers);
  document.getElementById('songCount').textContent = String(songs.length);
  document.getElementById('recentSongCount').textContent = String(recentSongs);
};

const deleteUser = async (id) => {
  await fetch(`${API_BASE}/api/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders() });
  loadAdminData();
};

const deleteSong = async (id) => {
  await fetch(`${API_BASE}/api/admin/songs/${id}`, { method: 'DELETE', headers: adminHeaders() });
  loadAdminData();
};

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('adminLoginForm');
  form.addEventListener('submit', async (e) => {
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

  const logout = document.getElementById('adminLogoutBtn');
  logout.addEventListener('click', () => {
    localStorage.removeItem('xodiAdminToken');
    adminAuthGuard();
  });

  wireAdminNav();
  adminAuthGuard();
});
