const express = require('express');
const authMiddleware = require('../middleware/auth');
const pointsService = require('../services/pointsService');

const router = express.Router();
router.use(authMiddleware);

router.get('/balance', async (req, res) => {
  try {
    const data = await pointsService.getPointsBalance(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('Points balance error:', err);
    res.status(500).json({ error: err.message || 'Failed to get points balance' });
  }
});

router.post('/daily', async (req, res) => {
  try {
    const result = await pointsService.claimDailyPoints(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Daily claim failed' });
  }
});

router.post('/convert', async (req, res) => {
  try {
    const { amount } = req.body;
    const result = await pointsService.convertPointsToZhu(req.user.id, amount);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Conversion failed' });
  }
});

module.exports = router;
