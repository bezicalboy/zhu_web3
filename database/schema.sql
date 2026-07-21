-- ZHU Platform Database Schema
-- Target: PostgreSQL 14+

-- ── Extensions ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enum Types ──
DO $$ BEGIN
  CREATE TYPE deposit_status AS ENUM ('pending', 'confirmed', 'credited');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE withdrawal_status AS ENUM ('queued', 'processing', 'broadcast', 'confirmed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sweep_status AS ENUM ('queued', 'processing', 'broadcast', 'confirmed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Users ──
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  zhu_balance      NUMERIC(36, 18) NOT NULL DEFAULT 0,
  points_balance   NUMERIC(36, 18) NOT NULL DEFAULT 0,
  derivation_index INTEGER UNIQUE NOT NULL,
  deposit_address  VARCHAR(42) NOT NULL,
  referral_code    VARCHAR(16) UNIQUE,
  referred_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_daily_claim DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist if table was already created
ALTER TABLE users ADD COLUMN IF NOT EXISTS points_balance NUMERIC(36, 18) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_claim TIMESTAMPTZ;
ALTER TABLE users ALTER COLUMN last_daily_claim TYPE TIMESTAMPTZ USING last_daily_claim::TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_faucet_claim TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deposit_address ON users(deposit_address);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- ── Deposits ──
CREATE TABLE IF NOT EXISTS deposits (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_hash         VARCHAR(66) UNIQUE NOT NULL,
  block_number    BIGINT NOT NULL,
  from_address    VARCHAR(42) NOT NULL,
  amount          NUMERIC(36, 18) NOT NULL,
  confirmations   INTEGER NOT NULL DEFAULT 0,
  status          deposit_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_tx_hash ON deposits(tx_hash);

-- ── Withdrawals ──
CREATE TABLE IF NOT EXISTS withdrawals (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_address      VARCHAR(42) NOT NULL,
  amount          NUMERIC(36, 18) NOT NULL,
  tx_hash         VARCHAR(66),
  status          withdrawal_status NOT NULL DEFAULT 'queued',
  retry_count     INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- ── Sweeps ──
CREATE TABLE IF NOT EXISTS sweeps (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_address    VARCHAR(42) NOT NULL,
  amount          NUMERIC(36, 18) NOT NULL,
  tx_hash         VARCHAR(66),
  status          sweep_status NOT NULL DEFAULT 'queued',
  retry_count     INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sweeps_user_id ON sweeps(user_id);
CREATE INDEX IF NOT EXISTS idx_sweeps_status ON sweeps(status);

-- ── Referral Rewards ──
CREATE TABLE IF NOT EXISTS referral_rewards (
  id            SERIAL PRIMARY KEY,
  referrer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_type   VARCHAR(50) NOT NULL, -- 'signup_bonus', 'game_commission', 'deposit_bonus'
  points_amount NUMERIC(36, 18) NOT NULL DEFAULT 0,
  zhu_amount    NUMERIC(36, 18) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id);

-- ── Dice Games ──
CREATE TABLE IF NOT EXISTS dice_games (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency      VARCHAR(10) NOT NULL DEFAULT 'zhu', -- 'zhu' or 'points'
  bet_amount    NUMERIC(36, 18) NOT NULL,
  roll_target   INTEGER NOT NULL,
  roll_over     BOOLEAN NOT NULL,
  roll_result   INTEGER NOT NULL,
  multiplier    NUMERIC(10, 4) NOT NULL,
  payout        NUMERIC(36, 18) NOT NULL,
  is_win        BOOLEAN NOT NULL,
  points_earned NUMERIC(36, 18) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dice_games_user ON dice_games(user_id);

-- ── Spin Results ──
CREATE TABLE IF NOT EXISTS spin_results (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cost_points   NUMERIC(36, 18) NOT NULL DEFAULT 100,
  prize_type    VARCHAR(20) NOT NULL, -- 'points', 'zhu', 'nothing'
  prize_amount  NUMERIC(36, 18) NOT NULL DEFAULT 0,
  segment_index INTEGER NOT NULL,
  label         VARCHAR(50) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spin_results_user ON spin_results(user_id);

-- ── Point Conversions ──
CREATE TABLE IF NOT EXISTS point_conversions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_spent NUMERIC(36, 18) NOT NULL,
  zhu_received NUMERIC(36, 18) NOT NULL,
  rate         NUMERIC(18, 6) NOT NULL DEFAULT 1000, -- e.g. 1000 points = 1 ZHU
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_conversions_user ON point_conversions(user_id);

-- ── Scanner State (singleton) ──
CREATE TABLE IF NOT EXISTS scanner_state (
  id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_processed_block  BIGINT NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO scanner_state (id, last_processed_block)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
