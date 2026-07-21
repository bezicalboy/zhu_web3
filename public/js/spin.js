app.checkAuth();
app.renderNav('spin');

const canvas = document.getElementById('wheel-canvas');
const ctx = canvas.getContext('2d');

let selectedCurrency = 'points';

const POINTS_SEGMENTS = [
  { label: '10 PTS', color: '#1e293b' },
  { label: '50 PTS', color: '#334155' },
  { label: '200 PTS', color: '#0f766e' },
  { label: '0.1 ZHU', color: '#0284c7' },
  { label: '500 PTS', color: '#6d28d9' },
  { label: '0.5 ZHU', color: '#7c3aed' },
  { label: '1.0 ZHU', color: '#059669' },
  { label: '5 ZHU 💎', color: '#eab308' }
];

const ZHU_SEGMENTS = [
  { label: '0.2 ZHU', color: '#1e293b' },
  { label: '0.5 ZHU', color: '#334155' },
  { label: '1.5 ZHU', color: '#0f766e' },
  { label: '500 PTS', color: '#0284c7' },
  { label: '2.5 ZHU', color: '#6d28d9' },
  { label: '5.0 ZHU', color: '#7c3aed' },
  { label: '1000 PTS', color: '#059669' },
  { label: '20 ZHU 💎', color: '#eab308' }
];

let activeSegments = POINTS_SEGMENTS;
const numSegments = 8;
const arcSize = (2 * Math.PI) / numSegments;
let currentRotation = 0;
let isSpinning = false;

function drawWheel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = canvas.width / 2 - 10;

  for (let i = 0; i < numSegments; i++) {
    const angle = i * arcSize;

    // Draw segment slice
    ctx.beginPath();
    ctx.fillStyle = activeSegments[i].color;
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, angle, angle + arcSize);
    ctx.lineTo(centerX, centerY);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw text
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle + arcSize / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(activeSegments[i].label, radius - 20, 5);
    ctx.restore();
  }
}

// Mode Selection Handlers
document.getElementById('spin-curr-points').addEventListener('click', () => {
  if (isSpinning) return;
  selectedCurrency = 'points';
  activeSegments = POINTS_SEGMENTS;
  document.getElementById('spin-curr-points').className = 'btn';
  document.getElementById('spin-curr-zhu').className = 'btn btn-secondary';
  document.getElementById('cost-display').textContent = '100 Points';
  document.getElementById('spin-btn').textContent = '🎡 Spin Now (100 PTS)';
  drawWheel();
});

document.getElementById('spin-curr-zhu').addEventListener('click', () => {
  if (isSpinning) return;
  selectedCurrency = 'zhu';
  activeSegments = ZHU_SEGMENTS;
  document.getElementById('spin-curr-zhu').className = 'btn';
  document.getElementById('spin-curr-points').className = 'btn btn-secondary';
  document.getElementById('cost-display').textContent = '1.0 ZHU';
  document.getElementById('spin-btn').textContent = '🎡 Spin Now (1.0 ZHU)';
  drawWheel();
});

// Spin Action Handler
document.getElementById('spin-btn').addEventListener('click', async () => {
  if (isSpinning) return;

  const btn = document.getElementById('spin-btn');
  const errorAlert = document.getElementById('error-alert');
  const resultBox = document.getElementById('spin-result-box');

  try {
    errorAlert.style.display = 'none';
    btn.disabled = true;
    isSpinning = true;
    resultBox.textContent = 'Spinning... 🎰';

    const res = await app.api.post('/api/game/spin', { currency: selectedCurrency });

    // Target segment index
    const targetIndex = res.segmentIndex;

    // Calculate rotation to align target segment at top (270 degrees / 1.5 PI)
    const segmentCenterAngle = (targetIndex * arcSize) + (arcSize / 2);
    const targetAngle = (1.5 * Math.PI) - segmentCenterAngle;

    // Add 5 full rotations (10 * PI)
    currentRotation += (10 * Math.PI) + targetAngle;

    canvas.style.transform = `rotate(${currentRotation}rad)`;

    setTimeout(() => {
      isSpinning = false;
      btn.disabled = false;
      resultBox.innerHTML = `🎉 Congratulations! You won <strong style="color: var(--primary-teal);">${res.label}</strong>!`;
      app.showToast(`Won ${res.label}!`, 'success');
      loadHistory();
    }, 4000);

  } catch (err) {
    isSpinning = false;
    btn.disabled = false;
    errorAlert.textContent = err.message || 'Spin failed.';
    errorAlert.style.display = 'flex';
  }
});

async function loadHistory() {
  try {
    const res = await app.api.get('/api/game/spin/history?limit=10');
    const tbody = document.getElementById('spin-history-body');

    if (res.history && res.history.length > 0) {
      tbody.innerHTML = res.history.map(spin => `
        <tr>
          <td><strong style="color: var(--primary-teal);">${spin.label}</strong></td>
          <td>${spin.cost_points} ${spin.label.includes('(ZHU)') ? 'ZHU' : 'PTS'}</td>
          <td class="text-secondary">${app.formatDate(spin.created_at)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Spin history error:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  drawWheel();
  loadHistory();
});
