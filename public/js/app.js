const API_BASE = ''; // Backend is at same origin

const app = {
  getToken: () => localStorage.getItem('zhu_token'),
  setToken: (token) => localStorage.setItem('zhu_token', token),
  removeToken: () => localStorage.removeItem('zhu_token'),
  isLoggedIn: () => !!localStorage.getItem('zhu_token'),

  api: {
    async request(path, options = {}) {
      const url = `${API_BASE}${path}`;
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      const token = app.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
          app.removeToken();
          window.location.href = '/index.html';
          return null;
        }

        const contentType = response.headers.get('content-type') || '';
        let data = {};
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          throw new Error(`Server response error (${response.status})`);
        }

        if (!response.ok) {
          throw new Error(data.message || data.error || 'API request failed');
        }
        return data;
      } catch (error) {
        throw error;
      }
    },
    get(path) {
      return this.request(path, { method: 'GET' });
    },
    post(path, body = {}) {
      return this.request(path, { method: 'POST', body: JSON.stringify(body || {}) });
    }
  },

  checkAuth: () => {
    if (!app.isLoggedIn()) {
      window.location.href = '/index.html';
    }
  },

  redirectIfAuth: () => {
    if (app.isLoggedIn()) {
      window.location.href = '/dashboard.html';
    }
  },

  formatBalance: (balance) => {
    if (balance === undefined || balance === null) return '0.0000';
    return Number(balance).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  },

  formatPoints: (points) => {
    if (points === undefined || points === null) return '0';
    return Number(points).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  formatDate: (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days > 0) {
      return `${days} d ago`;
    } else if (hours > 0) {
      return `${hours} h ago`;
    } else if (minutes > 0) {
      return `${minutes} min ago`;
    } else {
      return 'Just now';
    }
  },

  truncateAddress: (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  },

  showToast: (message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  copyToClipboard: async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      app.showToast('Copied to clipboard!', 'success');
    } catch (err) {
      app.showToast('Failed to copy', 'error');
    }
  },

  renderNav: (activePage) => {
    const navHTML = `
      <div id="mobile-top-bar" class="mobile-top-bar">
        <button type="button" id="mobile-menu-btn" class="menu-toggle-btn" aria-label="Open Navigation">☰</button>
        <div style="font-family: var(--font-heading); font-weight: 800; font-size: 1.25rem;">
          <span class="text-gradient">ZHU</span> Web3
        </div>
        <div style="width: 40px;"></div>
      </div>

      <div id="nav-backdrop"></div>

      <nav class="nav-sidebar" id="nav-sidebar">
        <div class="nav-brand">
          <span><strong class="text-gradient">ZHU</strong> Web3</span>
          <button type="button" id="drawer-close-btn" class="drawer-close-btn" aria-label="Close Navigation">✕</button>
        </div>
        <ul class="nav-links">
          <li>
            <a href="/dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">
              Dashboard
            </a>
          </li>
          <li>
            <a href="/dice.html" class="nav-link ${activePage === 'dice' ? 'active' : ''}">
              Dice Game
            </a>
          </li>
          <li>
            <a href="/spin.html" class="nav-link ${activePage === 'spin' ? 'active' : ''}">
              Spin Wheel
            </a>
          </li>
          <li>
            <a href="/points.html" class="nav-link ${activePage === 'points' ? 'active' : ''}">
              Points & Swap
            </a>
          </li>
          <li>
            <a href="/referral.html" class="nav-link ${activePage === 'referral' ? 'active' : ''}">
              Referrals
            </a>
          </li>
          <li>
            <a href="/deposit.html" class="nav-link ${activePage === 'deposit' ? 'active' : ''}">
              Deposit
            </a>
          </li>
          <li>
            <a href="/withdraw.html" class="nav-link ${activePage === 'withdraw' ? 'active' : ''}">
              Withdraw
            </a>
          </li>
          <li>
            <a href="/history.html" class="nav-link ${activePage === 'history' ? 'active' : ''}">
              History
            </a>
          </li>
        </ul>
        <div class="nav-footer">
          <a href="#" id="logout-btn" class="nav-link">
            Logout
          </a>
        </div>
      </nav>
    `;

    const div = document.createElement('div');
    div.innerHTML = navHTML;
    while (div.firstElementChild) {
      document.body.insertBefore(div.firstElementChild, document.body.firstChild);
    }

    const sidebar = document.getElementById('nav-sidebar');
    const backdrop = document.getElementById('nav-backdrop');
    const menuBtn = document.getElementById('mobile-menu-btn');
    const closeBtn = document.getElementById('drawer-close-btn');

    function openDrawer() {
      sidebar?.classList.add('open');
      backdrop?.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      sidebar?.classList.remove('open');
      backdrop?.classList.remove('active');
      document.body.style.overflow = '';
    }

    menuBtn?.addEventListener('click', openDrawer);
    closeBtn?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', closeDrawer);

    document.getElementById('logout-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      app.removeToken();
      window.location.href = '/index.html';
    });
  }
};
