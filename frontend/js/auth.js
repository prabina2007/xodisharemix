window.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signupForm');
  const verifyForm = document.getElementById('verifyForm');
  const loginForm = document.getElementById('loginForm');
  const msg = document.getElementById('messageBox');

  const setMsg = (text, isError = false) => {
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = isError ? 'var(--danger)' : 'var(--accent)';
  };

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;

      const res = await fetch(`${API_BASE}/api/auth/signup/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) return setMsg(data.message || 'Failed to send OTP', true);

      setMsg(`OTP sent. ${data.devOtp ? `Dev OTP: ${data.devOtp}` : 'Check your email.'}`);
      verifyForm.style.display = 'grid';
      document.getElementById('verifyEmail').value = email;
    });
  }

  if (verifyForm) {
    verifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('verifyEmail').value.trim();
      const otp = document.getElementById('verifyOtp').value.trim();

      const res = await fetch(`${API_BASE}/api/auth/signup/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();

      if (!res.ok) return setMsg(data.message || 'OTP verification failed', true);

      localStorage.setItem('xodiToken', data.token);
      setMsg('Signup verified. Redirecting to dashboard...');
      setTimeout(() => (window.location.href = '/dashboard.html'), 700);
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) return setMsg(data.message || 'Login failed', true);

      localStorage.setItem('xodiToken', data.token);
      setMsg('Login successful. Redirecting...');
      setTimeout(() => (window.location.href = '/dashboard.html'), 600);
    });
  }
});