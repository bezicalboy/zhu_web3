const express = require('express');
const authMiddleware = require('../middleware/auth');
const referralService = require('../services/referralService');

const router = express.Router();
router.use(authMiddleware);

router.get('/stats', async (req, res) => {
  try {
    const stats = await referralService.getReferralStats(req.user.id);
    res.json(stats);
  } catch (err) {
    console.error('Referral stats error:', err);
    res.status(500).json({ error: 'Failed to load referral stats' });
  }
});

module.exports = router;
