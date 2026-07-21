app.checkAuth();
app.renderNav('withdraw');

let currentBalance = 0;

async function loadBalance() {
  try {
    const res = await app.api.get('/api/wallet/balance');
    currentBalance = Number(res.balance);
    document.getElementById('current-balance').textContent = app.formatBalance(currentBalance);
  } catch (err) {
    app.showToast('Failed to load balance', 'error');
  }
}

document.getElementById('max-btn').addEventListener('click', () => {
  document.getElementById('amount').value = currentBalance;
});

document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const address = document.getElementById('address').value.trim();
  const amount = Number(document.getElementById('amount').value);
  const btn = document.getElementById('withdraw-btn');
  const errorAlert = document.getElementById('error-alert');
  
  // Basic validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    errorAlert.textContent = 'Invalid address format. Must be a 0x-prefixed 40-character hex string.';
    errorAlert.style.display = 'flex';
    return;
  }
  
  if (amount <= 0 || amount > currentBalance) {
    errorAlert.textContent = 'Invalid amount. Must be greater than 0 and less than or equal to your balance.';
    errorAlert.style.display = 'flex';
    return;
  }
  
  try {
    btn.disabled = true;
    btn.textContent = 'Processing...';
    errorAlert.style.display = 'none';
    
    await app.api.post('/api/wallet/withdraw', { toAddress: address, amount });
    
    app.showToast('Withdrawal request submitted successfully!', 'success');
    setTimeout(() => {
      window.location.href = '/history.html';
    }, 1500);
    
  } catch (err) {
    errorAlert.textContent = err.message || 'Withdrawal failed.';
    errorAlert.style.display = 'flex';
    btn.disabled = false;
    btn.textContent = 'Confirm Withdrawal';
  }
});

document.addEventListener('DOMContentLoaded', loadBalance);
