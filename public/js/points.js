app.checkAuth();
app.renderNav('points');

const pointsInput = document.getElementById('swap-points-input');
const zhuOutput = document.getElementById('swap-zhu-output');

async function loadPointsInfo() {
  try {
    const res = await app.api.get('/api/points/balance');
    document.getElementById('points-bal-display').textContent = app.formatPoints(res.pointsBalance);

    const claimBtn = document.getElementById('daily-claim-btn');
    const dailyMsg = document.getElementById('daily-msg');

    if (res.canClaimDaily) {
      claimBtn.disabled = false;
      claimBtn.textContent = 'Claim Daily +50 PTS';
      dailyMsg.textContent = 'Available now!';
    } else {
      claimBtn.disabled = true;
      claimBtn.textContent = 'Claimed Today';
      dailyMsg.textContent = 'Come back tomorrow for your next claim!';
    }
  } catch (err) {
    app.showToast('Failed to load points balance', 'error');
  }
}

// Live Swap Calculation
pointsInput.addEventListener('input', () => {
  const points = parseFloat(pointsInput.value || '0');
  if (points > 0) {
    const zhu = (points / 1000).toFixed(4);
    zhuOutput.value = `${zhu} ZHU`;
  } else {
    zhuOutput.value = '0.0000 ZHU';
  }
});

// Daily Claim Action
document.getElementById('daily-claim-btn').addEventListener('click', async () => {
  const btn = document.getElementById('daily-claim-btn');
  try {
    btn.disabled = true;
    const res = await app.api.post('/api/points/daily');
    app.showToast(res.message || 'Claimed 50 PTS!', 'success');
    loadPointsInfo();
  } catch (err) {
    app.showToast(err.message || 'Daily claim failed', 'error');
    loadPointsInfo();
  }
});

// Faucet Claim Action
document.getElementById('faucet-claim-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('faucet-claim-btn');
  try {
    btn.disabled = true;
    btn.textContent = 'Claiming...';
    const res = await app.api.post('/api/wallet/faucet', {});
    app.showToast(res.message || 'Claimed +10 ZHU Test Tokens!', 'success');
    btn.textContent = 'Claimed +10 ZHU!';
    loadPointsInfo();
  } catch (err) {
    app.showToast(err.message || 'Faucet claim failed', 'error');
    btn.disabled = false;
    btn.textContent = 'Claim +10 ZHU';
  }
});

// Execute Swap Action
document.getElementById('execute-swap-btn').addEventListener('click', async () => {
  const btn = document.getElementById('execute-swap-btn');
  const errorAlert = document.getElementById('swap-error');
  const amount = parseFloat(pointsInput.value);

  if (isNaN(amount) || amount < 100) {
    errorAlert.textContent = 'Minimum swap amount is 100 points.';
    errorAlert.style.display = 'flex';
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = 'Swapping...';
    errorAlert.style.display = 'none';

    const res = await app.api.post('/api/points/convert', { amount });

    app.showToast(`Swapped ${res.pointsSpent} PTS for ${res.zhuReceived} ZHU!`, 'success');
    pointsInput.value = '';
    zhuOutput.value = '0.0000 ZHU';
    loadPointsInfo();

  } catch (err) {
    errorAlert.textContent = err.message || 'Swap failed.';
    errorAlert.style.display = 'flex';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Swap Points to ZHU ➔';
  }
});

document.addEventListener('DOMContentLoaded', loadPointsInfo);
