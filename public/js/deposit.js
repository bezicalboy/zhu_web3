app.checkAuth();
app.renderNav('deposit');

async function loadDepositInfo() {
  try {
    const res = await app.api.get('/api/wallet/deposit');

    const container = document.getElementById('deposit-content');
    container.innerHTML = `
      <p class="text-secondary" style="margin-bottom: 0.5rem; font-weight: 600;">Your On-Chain Deposit Address</p>
      
      <div class="qr-container">
        <img src="${res.qrCode}" alt="Deposit QR Code" />
      </div>
      
      <div class="address-box">
        <span class="address-text" id="wallet-address">${res.address}</span>
        <button class="btn btn-secondary" onclick="app.copyToClipboard('${res.address}')" style="padding: 0.4rem 0.85rem; font-size: 0.85rem;">
          Copy
        </button>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Network</div>
          <div class="info-value">${res.network || 'Base Sepolia'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Token</div>
          <div class="info-value">${res.tokenSymbol || 'ZHU'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Min Deposit</div>
          <div class="info-value">${res.minDeposit || '0'} ZHU</div>
        </div>
        <div class="info-item">
          <div class="info-label">Est. Time</div>
          <div class="info-value">${res.estimatedConfirmationTime || '~2 mins'}</div>
        </div>
      </div>
    `;

  } catch (err) {
    app.showToast('Failed to load deposit information', 'error');
    document.getElementById('deposit-content').innerHTML = `
      <div class="alert alert-error">Failed to load deposit info. Please try again later.</div>
    `;
  }
}

// Faucet Claim Action
document.getElementById('faucet-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('faucet-btn');
  try {
    btn.disabled = true;
    btn.textContent = 'Claiming...';
    const res = await app.api.post('/api/wallet/faucet', {});
    app.showToast(res.message || 'Claimed +10 ZHU Test Tokens!', 'success');
    btn.textContent = 'Claimed +10 ZHU!';
  } catch (err) {
    app.showToast(err.message || 'Faucet claim failed', 'error');
    btn.disabled = false;
    btn.textContent = 'Claim +10 ZHU';
  }
});

document.addEventListener('DOMContentLoaded', loadDepositInfo);
