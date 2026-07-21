const db = require('../db');

// Dice Game
async function playDice(userId, { betAmount, rollTarget, rollOver, currency = 'zhu' }) {
  const amount = parseFloat(betAmount);
  const target = parseInt(rollTarget, 10);
  const isOver = Boolean(rollOver);
  const curr = (currency || 'zhu').toLowerCase();

  if (!['zhu', 'points'].includes(curr)) {
    throw new Error("Currency must be 'zhu' or 'points'");
  }

  if (isNaN(amount) || amount <= 0) {
    throw new Error('Bet amount must be greater than 0');
  }

  // Restrict target between 15 and 85 to prevent free 95% farming
  if (isNaN(target) || target < 15 || target > 85) {
    throw new Error('Roll target must be between 15 and 85');
  }

  // Win probability
  const winChance = isOver ? (100 - target) : target;
  if (winChance < 15 || winChance > 85) {
    throw new Error('Win probability must be between 15% and 85%');
  }

  // Scaled house edge: 5% for high risk (<=50% win chance), scaling up to 15% for safe bets (>50% win chance)
  const edgeFactor = winChance <= 50 ? 95 : (95 - (winChance - 50) * 0.3);
  const multiplier = Math.round((edgeFactor / winChance) * 10000) / 10000;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Balance check
    const balanceCol = curr === 'zhu' ? 'zhu_balance' : 'points_balance';
    const userRes = await client.query(`SELECT ${balanceCol}, referred_by FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    if (userRes.rows.length === 0) throw new Error('User not found');

    const currentBalance = parseFloat(userRes.rows[0][balanceCol] || 0);
    if (currentBalance < amount) {
      throw new Error(`Insufficient ${curr.toUpperCase()} balance. Current balance: ${currentBalance}`);
    }

    // Roll random result 1 - 100
    const rollResult = Math.floor(Math.random() * 100) + 1;
    const isWin = isOver ? (rollResult > target) : (rollResult < target);

    const payout = isWin ? Math.round((amount * multiplier) * 10000) / 10000 : 0;
    const netChange = isWin ? (payout - amount) : -amount;

    // Risk-based points reward: High risk (e.g. 15% win chance) = High points reward (+72 PTS per ZHU)
    // Low risk (e.g. 85% win chance) = Minimal points reward (+1 PTS per ZHU)
    const riskFactor = (100 - winChance) / 100;
    const pointsEarned = curr === 'zhu' 
      ? Math.max(1, Math.round(amount * 100 * Math.pow(riskFactor, 2)))
      : Math.max(0, Math.round(amount * 0.2 * riskFactor));

    // Update user balance
    let pointsDelta = pointsEarned;
    let zhuDelta = 0;

    if (curr === 'points') {
      pointsDelta += netChange;
    } else {
      zhuDelta += netChange;
    }

    await client.query(
      'UPDATE users SET points_balance = points_balance + $1, zhu_balance = zhu_balance + $2 WHERE id = $3',
      [pointsDelta, zhuDelta, userId]
    );

    // Record game
    const gameRes = await client.query(
      `INSERT INTO dice_games (user_id, currency, bet_amount, roll_target, roll_over, roll_result, multiplier, payout, is_win, points_earned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, roll_result, is_win, payout, multiplier, points_earned, created_at`,
      [userId, curr, amount, target, isOver, rollResult, multiplier, payout, isWin, pointsEarned]
    );

    // Referral commission (5% of wager as points for referrer)
    const referrerId = userRes.rows[0].referred_by;
    if (referrerId) {
      const refCommission = Math.max(1, Math.round(pointsEarned * 0.5));
      await client.query('UPDATE users SET points_balance = points_balance + $1 WHERE id = $2', [refCommission, referrerId]);
      await client.query(
        `INSERT INTO referral_rewards (referrer_id, referee_id, reward_type, points_amount)
         VALUES ($1, $2, 'game_commission', $3)`,
        [referrerId, userId, refCommission]
      );
    }

    await client.query('COMMIT');

    return {
      gameId: gameRes.rows[0].id,
      rollResult,
      isWin,
      payout,
      multiplier,
      pointsEarned,
      currency: curr,
      netChange
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Spin Wheel Game (Points and ZHU options with realistic casino odds)
const POINTS_WHEEL_SEGMENTS = [
  { index: 0, label: '10 Points', type: 'points', amount: 10, weight: 45 },
  { index: 1, label: '50 Points', type: 'points', amount: 50, weight: 30 },
  { index: 2, label: '200 Points', type: 'points', amount: 200, weight: 15 },
  { index: 3, label: '0.1 ZHU', type: 'zhu', amount: 0.1, weight: 5 },
  { index: 4, label: '500 Points', type: 'points', amount: 500, weight: 3 },
  { index: 5, label: '0.5 ZHU', type: 'zhu', amount: 0.5, weight: 1.5 },
  { index: 6, label: '1.0 ZHU', type: 'zhu', amount: 1.0, weight: 0.4 },
  { index: 7, label: '5.0 ZHU JACKPOT!', type: 'zhu', amount: 5.0, weight: 0.1 }
];

const ZHU_WHEEL_SEGMENTS = [
  { index: 0, label: '0.2 ZHU', type: 'zhu', amount: 0.2, weight: 45 },
  { index: 1, label: '0.5 ZHU', type: 'zhu', amount: 0.5, weight: 30 },
  { index: 2, label: '1.5 ZHU', type: 'zhu', amount: 1.5, weight: 15 },
  { index: 3, label: '500 PTS', type: 'points', amount: 500, weight: 5 },
  { index: 4, label: '2.5 ZHU', type: 'zhu', amount: 2.5, weight: 3 },
  { index: 5, label: '5.0 ZHU', type: 'zhu', amount: 5.0, weight: 1.5 },
  { index: 6, label: '1,000 PTS', type: 'points', amount: 1000, weight: 0.4 },
  { index: 7, label: '20.0 ZHU JACKPOT!', type: 'zhu', amount: 20.0, weight: 0.1 }
];

const SPIN_COST_POINTS = 100;
const SPIN_COST_ZHU = 1.0;

function getRandomSegment(segmentsList) {
  const totalWeight = segmentsList.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;

  for (const seg of segmentsList) {
    if (random < seg.weight) return seg;
    random -= seg.weight;
  }
  return segmentsList[0];
}

async function playSpin(userId, currency = 'points') {
  const curr = (currency || 'points').toLowerCase();
  if (!['points', 'zhu'].includes(curr)) {
    throw new Error("Currency must be 'points' or 'zhu'");
  }

  const cost = curr === 'points' ? SPIN_COST_POINTS : SPIN_COST_ZHU;
  const segmentsList = curr === 'points' ? POINTS_WHEEL_SEGMENTS : ZHU_WHEEL_SEGMENTS;
  const balanceCol = curr === 'points' ? 'points_balance' : 'zhu_balance';

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(`SELECT ${balanceCol} FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    if (userRes.rows.length === 0) throw new Error('User not found');

    const balance = parseFloat(userRes.rows[0][balanceCol] || 0);
    if (balance < cost) {
      throw new Error(`Insufficient ${curr.toUpperCase()} balance. Spin costs ${cost} ${curr.toUpperCase()}. You have ${balance}.`);
    }

    const prize = getRandomSegment(segmentsList);

    let pointsDelta = 0;
    let zhuDelta = 0;

    if (curr === 'points') {
      pointsDelta -= cost;
    } else {
      zhuDelta -= cost;
    }

    if (prize.type === 'points') {
      pointsDelta += prize.amount;
    } else if (prize.type === 'zhu') {
      zhuDelta += prize.amount;
    }

    await client.query(
      'UPDATE users SET points_balance = points_balance + $1, zhu_balance = zhu_balance + $2 WHERE id = $3',
      [pointsDelta, zhuDelta, userId]
    );

    // Record spin
    await client.query(
      `INSERT INTO spin_results (user_id, cost_points, prize_type, prize_amount, segment_index, label)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, cost, prize.type, prize.amount, prize.index, `${prize.label} (${curr.toUpperCase()})`]
    );

    await client.query('COMMIT');

    return {
      segmentIndex: prize.index,
      label: prize.label,
      prizeType: prize.type,
      prizeAmount: prize.amount,
      currency: curr,
      cost
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getDiceHistory(userId, limit = 20) {
  const res = await db.query(
    'SELECT id, currency, bet_amount, roll_target, roll_over, roll_result, multiplier, payout, is_win, points_earned, created_at FROM dice_games WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return res.rows;
}

async function getSpinHistory(userId, limit = 20) {
  const res = await db.query(
    'SELECT id, cost_points, prize_type, prize_amount, segment_index, label, created_at FROM spin_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return res.rows;
}

module.exports = {
  playDice,
  playSpin,
  getDiceHistory,
  getSpinHistory,
  POINTS_WHEEL_SEGMENTS,
  ZHU_WHEEL_SEGMENTS,
  SPIN_COST_POINTS,
  SPIN_COST_ZHU
};
