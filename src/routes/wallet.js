const express = require('express');
const qrcode = require('qrcode');
const { ethers } = require('ethers');
const config = require('../config');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/deposit', async (req, res) => {
  try {
    const address = req.user.deposit_address;
    const qrCode = await qrcode.toDataURL(address);

    res.json({
      address,
      qrCode,
      network: 'Base Sepolia',
      chainId: 84532,
      tokenSymbol: 'ZHU',
      minDeposit: config.minDepositAmount,
      estimatedConfirmationTime: '~45 seconds',
      requiredConfirmations: config.requiredConfirmations
    });
  } catch (error) {
    console.error('Deposit info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/balance', async (req, res) => {
  try {
    const result = await db.query('SELECT zhu_balance FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ balance: result.rows[0].zhu_balance });
  } catch (error) {
    console.error('Balance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/withdraw', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { toAddress, amount } = req.body;

    if (!toAddress || !ethers.isAddress(toAddress)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    const withdrawAmount = parseFloat(amount);
    const minWithdrawal = parseFloat(config.minWithdrawalAmount || '0');

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    if (withdrawAmount < minWithdrawal) {
      return res.status(400).json({ error: `Minimum withdrawal amount is ${minWithdrawal}` });
    }

    await client.query('BEGIN');

    // Check balance and lock row for update
    const userResult = await client.query('SELECT zhu_balance FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const balance = parseFloat(userResult.rows[0].zhu_balance);

    if (balance < withdrawAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct balance
    await client.query('UPDATE users SET zhu_balance = zhu_balance - $1, updated_at = NOW() WHERE id = $2', [withdrawAmount, req.user.id]);

    // Insert withdrawal
    const withdrawalResult = await client.query(
      `INSERT INTO withdrawals (user_id, to_address, amount, status, created_at, updated_at) 
       VALUES ($1, $2, $3, 'queued', NOW(), NOW()) RETURNING id, to_address, amount, status`,
      [req.user.id, toAddress, withdrawAmount]
    );

    await client.query('COMMIT');

    res.json({ withdrawal: withdrawalResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const { type = 'all', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const queryLimit = parseInt(limit);
    const userId = req.user.id;

    let transactions = [];
    let total = 0;

    if (type === 'all' || type === 'deposits') {
      const depositsResult = await db.query(
        `SELECT id, 'deposit' as type, amount, status, tx_hash, created_at
         FROM deposits WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
      transactions = transactions.concat(depositsResult.rows);
    }

    if (type === 'all' || type === 'withdrawals') {
      const withdrawalsResult = await db.query(
        `SELECT id, 'withdrawal' as type, amount, status, tx_hash, created_at
         FROM withdrawals WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
      transactions = transactions.concat(withdrawalsResult.rows);
    }

    // Sort combined results by created_at descending
    transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    total = transactions.length;

    // Apply pagination
    transactions = transactions.slice(offset, offset + queryLimit);

    res.json({ transactions, total });
  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/faucet', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      "SELECT (last_faucet_claim > NOW() - INTERVAL '1 hour') as recently_claimed FROM users WHERE id = $1 FOR UPDATE",
      [req.user.id]
    );

    if (userRes.rows[0]?.recently_claimed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Faucet cooldown active. You can claim 10 ZHU every 1 hour.' });
    }

    const faucetAmount = 10.0; // 10 ZHU test token

    await client.query(
      'UPDATE users SET zhu_balance = zhu_balance + $1, last_faucet_claim = NOW() WHERE id = $2',
      [faucetAmount, req.user.id]
    );

    // Record as confirmed deposit log
    await client.query(
      `INSERT INTO deposits (user_id, tx_hash, block_number, from_address, amount, confirmations, status)
       VALUES ($1, $2, 0, '0xFAUCET_TEST_NET', $3, 1, 'confirmed')
       ON CONFLICT (tx_hash) DO NOTHING`,
      [req.user.id, `faucet_${req.user.id}_${Date.now()}`, faucetAmount]
    );

    await client.query('COMMIT');

    res.json({
      claimed: faucetAmount,
      message: `Successfully claimed +${faucetAmount} ZHU test tokens directly to your wallet!`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Faucet error:', error);
    res.status(500).json({ error: 'Failed to claim faucet tokens' });
  } finally {
    client.release();
  }
});

module.exports = router;
