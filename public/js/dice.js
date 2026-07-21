app.checkAuth();
app.renderNav('dice');

let selectedCurrency = 'zhu';
let isOver = true;

const slider = document.getElementById('roll-slider');
const targetDisp = document.getElementById('target-disp');
const modeDisp = document.getElementById('mode-disp');
const winChanceDisp = document.getElementById('win-chance');
const multiplierDisp = document.getElementById('multiplier-disp');
const payoutDisp = document.getElementById('payout-disp');
const betInput = document.getElementById('bet-amount');

const trackFill = document.getElementById('track-fill');
const trackMarker = document.getElementById('track-marker');
const diceCube = document.getElementById('dice-cube');
const faceFront = document.getElementById('face-front');

function updateCalculations() {
  const target = parseInt(slider.value, 10);
  targetDisp.textContent = target;
  modeDisp.textContent = (isOver ? 'OVER ' : 'UNDER ') + target;

  const winChance = isOver ? (100 - target) : target;
  winChanceDisp.textContent = winChance + '%';

  // Dynamic House Edge: 5% on risky rolls (<=50% win chance), scaling up to 15% on safe rolls (>50% win chance)
  const edgeFactor = winChance <= 50 ? 95 : (95 - (winChance - 50) * 0.3);
  const mult = Math.round((edgeFactor / winChance) * 10000) / 10000;
  multiplierDisp.textContent = mult + 'x';

  const bet = parseFloat(betInput.value || '0');
  payoutDisp.textContent = (Math.round(bet * mult * 100) / 100) + ' ' + selectedCurrency.toUpperCase();

  // Risk-based reward calculation
  const riskFactor = (100 - winChance) / 100;
  const estPoints = selectedCurrency === 'zhu' 
    ? Math.max(1, Math.round(bet * 100 * Math.pow(riskFactor, 2)))
    : Math.max(0, Math.round(bet * 0.2 * riskFactor));

  const pointsText = document.getElementById('points-earned-text');
  if (pointsText) {
    pointsText.textContent = `Earn +${estPoints} Points on this roll (Risk Factor: ${Math.round(riskFactor * 100)}%)`;
  }

  // Position track marker at target
  if (trackMarker) {
    trackMarker.style.left = target + '%';
  }
}

// Event Listeners
document.getElementById('currency-zhu').addEventListener('click', () => {
  selectedCurrency = 'zhu';
  document.getElementById('currency-zhu').className = 'btn';
  document.getElementById('currency-points').className = 'btn btn-secondary';
  document.getElementById('currency-label').textContent = 'ZHU';
  updateCalculations();
});

document.getElementById('currency-points').addEventListener('click', () => {
  selectedCurrency = 'points';
  document.getElementById('currency-points').className = 'btn';
  document.getElementById('currency-zhu').className = 'btn btn-secondary';
  document.getElementById('currency-label').textContent = 'Points';
  updateCalculations();
});

document.getElementById('mode-over').addEventListener('click', () => {
  isOver = true;
  document.getElementById('mode-over').className = 'btn';
  document.getElementById('mode-under').className = 'btn btn-secondary';
  updateCalculations();
});

document.getElementById('mode-under').addEventListener('click', () => {
  isOver = false;
  document.getElementById('mode-under').className = 'btn';
  document.getElementById('mode-over').className = 'btn btn-secondary';
  updateCalculations();
});

slider.addEventListener('input', updateCalculations);
betInput.addEventListener('input', updateCalculations);

document.querySelectorAll('.quick-bet').forEach(btn => {
  btn.addEventListener('click', (e) => {
    betInput.value = e.target.dataset.amt;
    updateCalculations();
  });
});

// Animated Roll Action
document.getElementById('roll-btn').addEventListener('click', async () => {
  const btn = document.getElementById('roll-btn');
  const errorAlert = document.getElementById('error-alert');
  const resultDisp = document.getElementById('roll-result-display');
  const statusText = document.getElementById('roll-status-text');
  const pointsText = document.getElementById('points-earned-text');

  const betAmount = parseFloat(betInput.value);
  const rollTarget = parseInt(slider.value, 10);

  try {
    btn.disabled = true;
    btn.textContent = 'Rolling... 🎲';
    errorAlert.style.display = 'none';

    // Start 3D Cube Tumble Animation & Fast Ticker
    diceCube.classList.add('rolling');
    let tickerCount = 0;
    const tickerInterval = setInterval(() => {
      const tempRoll = Math.floor(Math.random() * 100) + 1;
      resultDisp.textContent = tempRoll;
      faceFront.textContent = tempRoll;
      tickerCount++;
    }, 50);

    // Call API
    const res = await app.api.post('/api/game/dice', {
      betAmount,
      rollTarget,
      rollOver: isOver,
      currency: selectedCurrency
    });

    // Wait for tumble animation feel (800ms min)
    setTimeout(() => {
      clearInterval(tickerInterval);
      diceCube.classList.remove('rolling');

      // Reveal final result
      resultDisp.textContent = res.rollResult;
      faceFront.textContent = res.rollResult;

      // Animate track fill to final position
      if (trackFill) {
        trackFill.style.width = res.rollResult + '%';
      }

      if (res.isWin) {
        resultDisp.className = 'result-modal win-text';
        statusText.className = 'win-text';
        statusText.textContent = `🎉 WIN! Won ${res.payout} ${selectedCurrency.toUpperCase()}`;
        app.showToast(`WIN! +${res.payout} ${selectedCurrency.toUpperCase()}`, 'success');
      } else {
        resultDisp.className = 'result-modal lose-text';
        statusText.className = 'lose-text';
        statusText.textContent = `💥 Missed! Target was ${isOver ? '>' : '<'} ${rollTarget}`;
      }

      pointsText.textContent = `+${res.pointsEarned} Points Earned from this roll!`;

      btn.disabled = false;
      btn.textContent = 'Roll Dice ➔';

      loadHistory();
    }, 800);

  } catch (err) {
    diceCube.classList.remove('rolling');
    errorAlert.textContent = err.message || 'Roll failed.';
    errorAlert.style.display = 'flex';
    btn.disabled = false;
    btn.textContent = 'Roll Dice ➔';
  }
});

async function loadHistory() {
  try {
    const res = await app.api.get('/api/game/dice/history?limit=10');
    const tbody = document.getElementById('dice-history-body');

    if (res.history && res.history.length > 0) {
      tbody.innerHTML = res.history.map(roll => `
        <tr>
          <td><strong class="${roll.is_win ? 'win-text' : 'lose-text'}">${roll.roll_result}</strong></td>
          <td>${roll.roll_over ? '>' : '<'} ${roll.roll_target}</td>
          <td>${roll.bet_amount} ${(roll.currency || 'zhu').toUpperCase()}</td>
          <td>${roll.multiplier}x</td>
          <td class="${roll.is_win ? 'win-text' : ''}">${roll.payout}</td>
          <td style="color: var(--primary-blue); font-weight: 700;">+${roll.points_earned}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('History load error:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateCalculations();
  loadHistory();
});
