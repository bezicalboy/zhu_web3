app.redirectIfAuth();

// Auto-fill referral code from URL if present (e.g. register.html?ref=XYZ123)
const urlParams = new URLSearchParams(window.location.search);
const refParam = urlParams.get('ref');
if (refParam) {
  const refInput = document.getElementById('referral-code');
  if (refInput) refInput.value = refParam.toUpperCase();
}

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const referralCode = document.getElementById('referral-code').value.trim();
  const btn = document.getElementById('register-btn');
  const errorAlert = document.getElementById('error-alert');

  if (password !== confirmPassword) {
    errorAlert.textContent = "Passwords don't match.";
    errorAlert.style.display = 'flex';
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = 'Registering...';
    errorAlert.style.display = 'none';

    const res = await app.api.post('/api/auth/register', { email, password, referralCode });
    if (res && res.token) {
      app.setToken(res.token);
      window.location.href = '/dashboard.html';
    }
  } catch (err) {
    errorAlert.textContent = err.message || 'Registration failed.';
    errorAlert.style.display = 'flex';
    btn.disabled = false;
    btn.textContent = 'Register & Claim Bonus';
  }
});
