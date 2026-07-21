const { ethers } = require('ethers');
const hdWalletService = require('./hdWalletService');
const config = require('../config');
const db = require('../db');

let isProcessing = false;
let withdrawalInterval = null;

async function startWithdrawalService() {
  if (isProcessing || withdrawalInterval) return;
  console.log('[Withdrawal] Starting withdrawal service...');
  
  // Cleanup any old stuck 'processing' records on startup
  try {
    await db.query("UPDATE withdrawals SET status = 'queued' WHERE status = 'processing' AND retry_count < 3");
  } catch (e) {
    console.error('[Withdrawal] Cleanup error on start:', e);
  }

  withdrawalInterval = setInterval(async () => {
    if (isProcessing) return;
    try {
      await processWithdrawals();
    } catch (err) {
      console.error('[Withdrawal] Error during interval:', err);
    }
  }, config.withdrawalIntervalMs || 30000);
}

function stopWithdrawalService() {
  if (withdrawalInterval) {
    clearInterval(withdrawalInterval);
    withdrawalInterval = null;
    console.log('[Withdrawal] Withdrawal service stopped.');
  }
}

async function processWithdrawals() {
  isProcessing = true;
  try {
    const withdrawals = await db.query(
      "SELECT * FROM withdrawals WHERE status = 'queued' AND retry_count < 3 ORDER BY created_at ASC"
    );

    for (const w of withdrawals.rows) {
      const currentRetry = (w.retry_count || 0) + 1;
      
      // Mark processing and update retry count
      await db.query(
        "UPDATE withdrawals SET status = 'processing', retry_count = $1, updated_at = NOW() WHERE id = $2",
        [currentRetry, w.id]
      );

      try {
        console.log(`[Withdrawal] Attempt ${currentRetry}/3: Processing withdrawal ${w.id} of ${w.amount} ZHU to ${w.to_address}`);
        
        const treasuryWallet = hdWalletService.getTreasuryWallet();
        const contract = hdWalletService.getZhuContract(treasuryWallet);

        const txAmount = ethers.parseUnits(w.amount.toString(), 18);
        const tx = await contract.transfer(w.to_address, txAmount);

        await db.query(
          "UPDATE withdrawals SET status = 'broadcast', tx_hash = $1, updated_at = NOW() WHERE id = $2",
          [tx.hash, w.id]
        );

        console.log(`[Withdrawal] Broadcast withdrawal ${w.id}, txHash: ${tx.hash}. Waiting for confirmation...`);
        await tx.wait();

        await db.query(
          "UPDATE withdrawals SET status = 'confirmed', updated_at = NOW() WHERE id = $1",
          [w.id]
        );
        console.log(`[Withdrawal] Confirmed withdrawal ${w.id}, txHash: ${tx.hash}`);

      } catch (err) {
        console.error(`[Withdrawal] Failed attempt ${currentRetry}/3 for withdrawal ${w.id}:`, err.message || err);

        const client = await db.pool.connect();
        try {
          await client.query('BEGIN');

          if (currentRetry >= 3) {
            // Max retries reached: Mark as failed and refund user balance back to game account
            await client.query(
              "UPDATE withdrawals SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2",
              [err.message || 'Withdrawal failed after 3 attempts', w.id]
            );

            await client.query(
              'UPDATE users SET zhu_balance = zhu_balance + $1, updated_at = NOW() WHERE id = $2',
              [w.amount, w.user_id]
            );

            await client.query('COMMIT');
            console.log(`[Withdrawal] Max retries reached (3/3). Refunded ${w.amount} ZHU back to user ${w.user_id} account.`);
          } else {
            // Re-queue for retry
            await client.query(
              "UPDATE withdrawals SET status = 'queued', error_message = $1, updated_at = NOW() WHERE id = $2",
              [err.message || 'Temporary transfer failure', w.id]
            );
            await client.query('COMMIT');
            console.log(`[Withdrawal] Withdrawal ${w.id} re-queued for retry (Attempt ${currentRetry}/3).`);
          }
        } catch (dbErr) {
          await client.query('ROLLBACK');
          console.error('[Withdrawal] Failed to process error/refund transaction:', dbErr);
        } finally {
          client.release();
        }
      }
    }
  } finally {
    isProcessing = false;
  }
}

module.exports = {
  startWithdrawalService,
  stopWithdrawalService,
  processWithdrawals
};
