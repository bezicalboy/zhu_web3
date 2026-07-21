const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const hdWalletService = require('../services/hdWalletService');
const referralService = require('../services/referralService');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, referralCode } = req.body;

    // Validate email format and password length
    if (!email || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if email already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Check referral code if provided
    let referrerId = null;
    if (referralCode && referralCode.trim() !== '') {
      const refRes = await db.query('SELECT id FROM users WHERE UPPER(referral_code) = UPPER($1)', [referralCode.trim()]);
      if (refRes.rows.length > 0) {
        referrerId = refRes.rows[0].id;
      }
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Get next derivation index
    const derivation_index = await hdWalletService.getNextDerivationIndex();

    // Derive deposit address
    const deposit_address = hdWalletService.deriveAddress(derivation_index);

    // Generate user's own referral code
    const myReferralCode = await referralService.getUniqueReferralCode();

    // Give 100 welcome bonus points if referred, else 50 initial points
    const initialPoints = referrerId ? 100 : 50;

    // Insert user into DB
    const insertResult = await db.query(
      `INSERT INTO users (email, password_hash, derivation_index, deposit_address, referral_code, referred_by, points_balance, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id, email, deposit_address, referral_code, points_balance`,
      [email, password_hash, derivation_index, deposit_address, myReferralCode, referrerId, initialPoints]
    );

    const user = insertResult.rows[0];

    // If referred, reward referrer with 100 bonus points!
    if (referrerId) {
      await db.query('UPDATE users SET points_balance = points_balance + 100 WHERE id = $1', [referrerId]);
      await db.query(
        `INSERT INTO referral_rewards (referrer_id, referee_id, reward_type, points_amount)
         VALUES ($1, $2, 'signup_bonus', 100)`,
        [referrerId, user.id]
      );
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const userResult = await db.query(
      'SELECT id, email, password_hash, zhu_balance, points_balance, deposit_address, referral_code FROM users WHERE email = $1',
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'No account found with this email address' });
    }

    const user = userResult.rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    // Auto-generate referral code if user doesn't have one yet
    if (!user.referral_code) {
      user.referral_code = await referralService.getUniqueReferralCode();
      await db.query('UPDATE users SET referral_code = $1 WHERE id = $2', [user.referral_code, user.id]);
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        zhu_balance: user.zhu_balance,
        points_balance: user.points_balance,
        deposit_address: user.deposit_address,
        referral_code: user.referral_code
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, zhu_balance, points_balance, derivation_index, deposit_address, referral_code, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    let user = result.rows[0];
    if (user && !user.referral_code) {
      const code = await referralService.getUniqueReferralCode();
      await db.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, user.id]);
      user.referral_code = code;
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
