const { ethers } = require('ethers');
const hdWalletService = require('./hdWalletService');
const config = require('../config');
const db = require('../db');

let isScanning = false;
let scannerInterval = null;

async function startScanner() {
  if (isScanning || scannerInterval) return;
  console.log('[Scanner] Starting blockchain scanner...');
  
  scannerInterval = setInterval(async () => {
    if (isScanning) return;
    isScanning = true;
    try {
      await scanBlocks();
    } catch (err) {
      console.error('[Scanner] Error during scan:', err);
    } finally {
      isScanning = false;
    }
  }, config.scannerIntervalMs);
}

function stopScanner() {
  if (scannerInterval) {
    clearInterval(scannerInterval);
    scannerInterval = null;
    console.log('[Scanner] Scanner stopped.');
  }
}

async function scanBlocks() {
  const provider = hdWalletService.getProvider();
  
  let res = await db.query('SELECT last_processed_block FROM scanner_state WHERE id = 1');
  let lastProcessedBlock = res.rows[0] ? Number(res.rows[0].last_processed_block) : 0;
  
  const currentBlock = await provider.getBlockNumber();
  
  if (lastProcessedBlock === 0) {
    lastProcessedBlock = currentBlock;
    await db.query('INSERT INTO scanner_state (id, last_processed_block, updated_at) VALUES (1, $1, NOW()) ON CONFLICT (id) DO UPDATE SET last_processed_block = EXCLUDED.last_processed_block', [lastProcessedBlock]);
  }
  
  if (lastProcessedBlock >= currentBlock) return;
  
  const toBlock = Math.min(lastProcessedBlock + 1000, currentBlock);
  console.log(`[Scanner] Scanning blocks ${lastProcessedBlock + 1} to ${toBlock}`);
  
  const contract = hdWalletService.getZhuContract(provider);
  const filter = contract.filters.Transfer(null, null);
  
  const logs = await contract.queryFilter(filter, lastProcessedBlock + 1, toBlock);
  
  for (const log of logs) {
    const fromAddress = log.args[0];
    const toAddress = log.args[1];
    const amount = log.args[2].toString();
    const txHash = log.transactionHash;
    const blockNumber = log.blockNumber;
    
    // Convert amount to numeric string representing ethers
    const formattedAmount = ethers.formatUnits(amount, 18);
    if (Number(formattedAmount) < config.minDepositAmount) continue;

    // Look up user
    const userRes = await db.query('SELECT id FROM users WHERE deposit_address = $1', [toAddress]);
    if (userRes.rows.length === 0) continue;
    
    const userId = userRes.rows[0].id;
    
    // Insert deposit
    try {
      await db.query(`
        INSERT INTO deposits (user_id, tx_hash, block_number, from_address, amount, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
        ON CONFLICT (tx_hash) DO NOTHING
      `, [userId, txHash, blockNumber, fromAddress, formattedAmount]);
      console.log(`[Scanner] Detected pending deposit: ${formattedAmount} ZHU for user ${userId} at block ${blockNumber}`);
    } catch (err) {
      console.error('[Scanner] Error inserting deposit:', err);
    }
  }
  
  // Confirm pending deposits
  const pendingRes = await db.query("SELECT id, user_id, amount, block_number FROM deposits WHERE status = 'pending'");
  for (const deposit of pendingRes.rows) {
    if (currentBlock - deposit.block_number >= config.requiredConfirmations) {
      try {
        await db.query('BEGIN');
        await db.query("UPDATE deposits SET status = 'credited', confirmations = $1 WHERE id = $2", [currentBlock - deposit.block_number, deposit.id]);
        await db.query("UPDATE users SET zhu_balance = zhu_balance + $1 WHERE id = $2", [deposit.amount, deposit.user_id]);
        await db.query('COMMIT');
        console.log(`[Scanner] Credited deposit ID ${deposit.id} to user ${deposit.user_id} (${deposit.amount} ZHU)`);
      } catch (err) {
        await db.query('ROLLBACK');
        console.error('[Scanner] Error crediting deposit:', err);
      }
    }
  }
  
  // Update scanner state
  await db.query('UPDATE scanner_state SET last_processed_block = $1, updated_at = NOW() WHERE id = 1', [toBlock]);
}

module.exports = {
  startScanner,
  stopScanner
};
