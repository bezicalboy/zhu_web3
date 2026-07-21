app.redirectIfAuth();

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const btn = document.getElementById('login-btn');
  const errorAlert = document.getElementById('error-alert');

  try {
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errorAlert.style.display = 'none';

    const res = await app.api.post('/api/auth/login', { email, password });
    if (res && res.token) {
      app.setToken(res.token);
      app.showToast('Login successful!', 'success');
      window.location.href = '/dashboard.html';
    }
  } catch (err) {
    const errorMsg = err.message || 'Incorrect email or password. Please try again.';
    errorAlert.textContent = errorMsg;
    errorAlert.style.display = 'flex';
    app.showToast(errorMsg, 'error');
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});
