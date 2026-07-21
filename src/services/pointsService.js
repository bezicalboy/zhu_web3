const db = require('../db');

const CONVERSION_RATE = 1000; // 1000 points = 1 ZHU
const DAILY_CLAIM_AMOUNT = 50; // 50 points daily claim

async function getPointsBalance(userId) {
  const res = await db.query(
    "SELECT points_balance, last_daily_claim, (last_daily_claim > NOW() - INTERVAL '24 hours') as recently_claimed FROM users WHERE id = $1",
    [userId]
  );
  if (res.rows.length === 0) throw new Error('User not found');

  const row = res.rows[0];
  const canClaimDaily = !row.recently_claimed;

  let nextClaimTime = null;
  if (row.last_daily_claim && !canClaimDaily) {
    const claimDate = new Date(row.last_daily_claim);
    nextClaimTime = new Date(claimDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  return {
    pointsBalance: parseFloat(row.points_balance || 0),
    canClaimDaily,
    nextClaimTime,
    dailyClaimAmount: DAILY_CLAIM_AMOUNT,
    conversionRate: CONVERSION_RATE
  };
}

async function claimDailyPoints(userId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      "SELECT points_balance, last_daily_claim, (last_daily_claim > NOW() - INTERVAL '24 hours') as recently_claimed FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    if (userRes.rows.length === 0) throw new Error('User not found');

    if (userRes.rows[0].recently_claimed) {
      throw new Error('Already claimed daily reward in the last 24 hours. Please wait before claiming again!');
    }

    await client.query(
      'UPDATE users SET points_balance = points_balance + $1, last_daily_claim = NOW() WHERE id = $2',
      [DAILY_CLAIM_AMOUNT, userId]
    );

    await client.query('COMMIT');
    return { claimed: DAILY_CLAIM_AMOUNT, message: `Successfully claimed ${DAILY_CLAIM_AMOUNT} points!` };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function convertPointsToZhu(userId, pointsToConvert) {
  const amount = parseFloat(pointsToConvert);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Invalid points amount');
  }
  if (amount < 100) {
    throw new Error('Minimum conversion is 100 points');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query('SELECT points_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const currentPoints = parseFloat(userRes.rows[0]?.points_balance || 0);

    if (currentPoints < amount) {
      throw new Error(`Insufficient points balance. You have ${currentPoints} points.`);
    }

    const zhuAmount = amount / CONVERSION_RATE;

    // Deduct points, credit ZHU
    await client.query('UPDATE users SET points_balance = points_balance - $1, zhu_balance = zhu_balance + $2 WHERE id = $3', [
      amount,
      zhuAmount,
      userId
    ]);

    // Record conversion history
    await client.query(
      'INSERT INTO point_conversions (user_id, points_spent, zhu_received, rate) VALUES ($1, $2, $3, $4)',
      [userId, amount, zhuAmount, CONVERSION_RATE]
    );

    await client.query('COMMIT');
    return {
      pointsSpent: amount,
      zhuReceived: zhuAmount,
      rate: CONVERSION_RATE
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getPointsBalance,
  claimDailyPoints,
  convertPointsToZhu,
  CONVERSION_RATE,
  DAILY_CLAIM_AMOUNT
};
