app.checkAuth();
app.renderNav('dashboard');

async function loadDashboard() {
  try {
    const [meRes, balRes, pointsRes, txRes] = await Promise.all([
      app.api.get('/api/auth/me'),
      app.api.get('/api/wallet/balance'),
      app.api.get('/api/points/balance').catch(() => ({ pointsBalance: 0 })),
      app.api.get('/api/wallet/transactions?type=all&page=1&limit=5').catch(() => ({ transactions: [] }))
    ]);

    const user = meRes.user || meRes;
    const email = user.email || '';

    const welcome = document.getElementById('welcome-msg');
    welcome.classList.remove('skeleton');
    welcome.removeAttribute('style');
    welcome.style.marginBottom = '0.25rem';
    welcome.style.display = 'block';
    welcome.textContent = 'Welcome back, ' + (email.split('@')[0]);

    document.getElementById('user-email-display').textContent = email;
    document.getElementById('avatar-initial').textContent = (email.charAt(0) || 'U').toUpperCase();

    document.getElementById('balance-display').textContent = app.formatBalance(balRes.balance || user.zhu_balance);
    document.getElementById('points-display').textContent = app.formatPoints(pointsRes.pointsBalance || user.points_balance);

    const tbody = document.getElementById('recent-tx-body');
    if (txRes && txRes.transactions && txRes.transactions.length > 0) {
      tbody.innerHTML = txRes.transactions.map(function(tx) {
        return '<tr>' +
          '<td style="text-transform: capitalize; font-weight: 600;">' + (tx.type || 'unknown') + '</td>' +
          '<td class="text-gradient" style="font-weight: 700;">' + app.formatBalance(Math.abs(tx.amount)) + ' ZHU</td>' +
          '<td><span class="badge ' + (tx.status || 'confirmed').toLowerCase() + '">' + tx.status + '</span></td>' +
          '<td class="text-secondary">' + app.formatDate(tx.created_at) + '</td>' +
          '</tr>';
      }).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No recent ledger activity</td></tr>';
    }

  } catch (err) {
    app.showToast('Failed to load dashboard', 'error');
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);
