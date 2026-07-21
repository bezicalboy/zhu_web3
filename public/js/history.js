app.checkAuth();
app.renderNav('history');

let currentPage = 1;
let currentType = 'all';
const limit = 10;

async function loadTransactions() {
  const tbody = document.getElementById('history-body');
  
  try {
    // Show skeleton
    tbody.innerHTML = Array(5).fill('<tr><td colspan="5" class="skeleton" style="height: 40px;"></td></tr>').join('');
    
    const res = await app.api.get(`/api/wallet/transactions?type=${currentType}&page=${currentPage}&limit=${limit}`);
    
    if (res.transactions && res.transactions.length > 0) {
      tbody.innerHTML = res.transactions.map(tx => {
        const isDeposit = tx.type === 'deposit' || tx.amount > 0;
        const typeStr = tx.type || (isDeposit ? 'Deposit' : 'Withdraw');
        
        let txHashHtml = '-';
        if (tx.tx_hash) {
          txHashHtml = `<a href="https://sepolia.basescan.org/tx/${tx.tx_hash}" target="_blank" rel="noopener noreferrer">${app.truncateAddress(tx.tx_hash)}</a>`;
        }
        
        return `
          <tr>
            <td style="text-transform: capitalize;">${typeStr}</td>
            <td class="${isDeposit ? 'text-gradient' : ''}">${app.formatBalance(Math.abs(tx.amount))} ZHU</td>
            <td><span class="badge ${tx.status.toLowerCase()}">${tx.status}</span></td>
            <td>${txHashHtml}</td>
            <td class="text-secondary">${app.formatDate(tx.created_at)}</td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No transactions found</td></tr>`;
    }
    
    // Pagination controls
    const total = res.total || 0;
    document.getElementById('current-page').textContent = currentPage;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage * limit >= total;
    
  } catch (err) {
    app.showToast('Failed to load transactions', 'error');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--error);">Error loading data</td></tr>`;
  }
}

// Event Listeners
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    
    currentType = e.target.dataset.type;
    currentPage = 1;
    loadTransactions();
  });
});

document.getElementById('prev-page').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    loadTransactions();
  }
});

document.getElementById('next-page').addEventListener('click', () => {
  currentPage++;
  loadTransactions();
});

document.addEventListener('DOMContentLoaded', loadTransactions);
