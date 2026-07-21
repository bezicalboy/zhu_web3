const db = require('../db');

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getUniqueReferralCode() {
  let code;
  let exists = true;
  while (exists) {
    code = generateCode();
    const res = await db.query('SELECT id FROM users WHERE referral_code = $1', [code]);
    if (res.rows.length === 0) {
      exists = false;
    }
  }
  return code;
}

async function getReferralStats(userId) {
  const userRes = await db.query('SELECT referral_code FROM users WHERE id = $1', [userId]);
  let code = userRes.rows[0]?.referral_code;

  if (!code) {
    code = await getUniqueReferralCode();
    await db.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, userId]);
  }

  const referralsRes = await db.query(
    'SELECT id, email, created_at FROM users WHERE referred_by = $1 ORDER BY created_at DESC',
    [userId]
  );

  const rewardsRes = await db.query(
    'SELECT SUM(points_amount) as total_points, SUM(zhu_amount) as total_zhu FROM referral_rewards WHERE referrer_id = $1',
    [userId]
  );

  return {
    referralCode: code,
    totalReferrals: referralsRes.rows.length,
    totalPointsEarned: rewardsRes.rows[0]?.total_points || 0,
    totalZhuEarned: rewardsRes.rows[0]?.total_zhu || 0,
    referrals: referralsRes.rows.map(r => ({
      email: r.email.split('@')[0] + '***@' + r.email.split('@')[1],
      joinedAt: r.created_at
    }))
  };
}

module.exports = {
  getUniqueReferralCode,
  getReferralStats
};
