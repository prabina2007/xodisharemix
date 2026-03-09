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

  const parseResponse = async (res) => {
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, data: JSON.parse(text) };
    } catch (_error) {
      return { ok: res.ok, status: res.status, data: { message: text || 'Unexpected server response' } };
    }
  };

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;
      const btn = signupForm.querySelector('button[type="submit"]');
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending...';

      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/auth/signup/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const parsed = await parseResponse(res);

        if (!parsed.ok) return setMsg(parsed.data.message || 'Failed to send OTP', true);

        setMsg(`OTP sent. ${parsed.data.devOtp ? `Dev OTP: ${parsed.data.devOtp}` : 'Check your email.'}`);
        verifyForm.style.display = 'grid';
        document.getElementById('verifyEmail').value = email;
      } catch (_error) {
        setMsg('Network error while sending OTP. Try again.', true);
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  if (verifyForm) {
    verifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('verifyEmail').value.trim();
      const otp = document.getElementById('verifyOtp').value.trim();
      const btn = verifyForm.querySelector('button[type="submit"]');
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Verifying...';

      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/auth/signup/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp }),
        });
        const parsed = await parseResponse(res);

        if (!parsed.ok) return setMsg(parsed.data.message || 'OTP verification failed', true);

        localStorage.setItem('xodiToken', parsed.data.token);
        setMsg('Signup verified. Redirecting to dashboard...');
        setTimeout(() => (window.location.href = '/dashboard.html'), 700);
      } catch (_error) {
        setMsg('Network error while verifying OTP. Try again.', true);
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const btn = loginForm.querySelector('button[type="submit"]');
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Signing in...';

      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const parsed = await parseResponse(res);

        if (!parsed.ok) return setMsg(parsed.data.message || 'Login failed', true);

        localStorage.setItem('xodiToken', parsed.data.token);
        setMsg('Login successful. Redirecting...');
        setTimeout(() => (window.location.href = '/dashboard.html'), 600);
      } catch (_error) {
        setMsg('Network error while logging in. Try again.', true);
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }
});
