app.checkAuth();
app.renderNav('referral');

let currentCode = '';
let currentLink = '';

async function loadReferralData() {
  try {
    const stats = await app.api.get('/api/referral/stats');
    currentCode = stats.referralCode;
    currentLink = `${window.location.origin}/register.html?ref=${currentCode}`;

    document.getElementById('ref-code-disp').textContent = currentCode;
    document.getElementById('ref-link-disp').textContent = currentLink;
    document.getElementById('stat-total-ref').textContent = stats.totalReferrals;
    document.getElementById('stat-points-earned').textContent = app.formatPoints(stats.totalPointsEarned) + ' PTS';

    const tbody = document.getElementById('ref-list-body');
    if (stats.referrals && stats.referrals.length > 0) {
      tbody.innerHTML = stats.referrals.map(ref => `
        <tr>
          <td><strong>${ref.email}</strong></td>
          <td class="text-secondary">${app.formatDate(ref.joinedAt)}</td>
          <td><span class="badge confirmed">Active (+100 PTS)</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    app.showToast('Failed to load referral stats', 'error');
  }
}

document.getElementById('copy-code-btn').addEventListener('click', () => {
  if (currentCode) app.copyToClipboard(currentCode);
});

document.getElementById('copy-link-btn').addEventListener('click', () => {
  if (currentLink) app.copyToClipboard(currentLink);
});

document.addEventListener('DOMContentLoaded', loadReferralData);
