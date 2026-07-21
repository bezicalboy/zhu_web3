const express = require('express');
const authMiddleware = require('../middleware/auth');
const gameService = require('../services/gameService');

const router = express.Router();
router.use(authMiddleware);

router.post('/dice', async (req, res) => {
  try {
    const { betAmount, rollTarget, rollOver, currency } = req.body;
    const result = await gameService.playDice(req.user.id, { betAmount, rollTarget, rollOver, currency });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Dice game failed' });
  }
});

router.post('/spin', async (req, res) => {
  try {
    const { currency = 'points' } = req.body;
    const result = await gameService.playSpin(req.user.id, currency);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Spin wheel failed' });
  }
});

router.get('/spin/config', (req, res) => {
  res.json({
    pointsSegments: gameService.POINTS_WHEEL_SEGMENTS,
    zhuSegments: gameService.ZHU_WHEEL_SEGMENTS,
    costPoints: gameService.SPIN_COST_POINTS,
    costZhu: gameService.SPIN_COST_ZHU
  });
});

router.get('/dice/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const history = await gameService.getDiceHistory(req.user.id, limit);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dice history' });
  }
});

router.get('/spin/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const history = await gameService.getSpinHistory(req.user.id, limit);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spin history' });
  }
});

module.exports = router;
