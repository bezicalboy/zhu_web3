const { ethers } = require('ethers');
const hdWalletService = require('./hdWalletService');
const config = require('../config');
const db = require('../db');

let isSweeping = false;
let sweepInterval = null;

async function startSweepService() {
  if (isSweeping || sweepInterval) return;
  console.log('[Sweep] Starting sweep service...');
  sweepInterval = setInterval(async () => {
    if (isSweeping) return;
    try {
      await sweepAll();
    } catch (err) {
      console.error('[Sweep] Error during sweep interval:', err);
    }
  }, config.sweepIntervalMs || 600000);
}

function stopSweepService() {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
    console.log('[Sweep] Sweep service stopped.');
  }
}

async function sweepAll() {
  isSweeping = true;
  try {
    const provider = hdWalletService.getProvider();
    const contract = hdWalletService.getZhuContract(provider);
    const treasuryAddress = hdWalletService.getTreasuryAddress();
    const treasuryWallet = hdWalletService.getTreasuryWallet();

    const usersRes = await db.query('SELECT id, deposit_address, derivation_index FROM users');
    
    for (const user of usersRes.rows) {
      const balance = await contract.balanceOf(user.deposit_address);
      if (balance === 0n) continue;

      const activeSweeps = await db.query(`
        SELECT id FROM sweeps 
        WHERE user_id = $1 AND status IN ('queued', 'processing', 'broadcast')
      `, [user.id]);
      if (activeSweeps.rows.length > 0) continue;

      const formattedAmount = ethers.formatUnits(balance, 18);
      
      const sweepRes = await db.query(`
        INSERT INTO sweeps (user_id, from_address, amount, status, retry_count, created_at)
        VALUES ($1, $2, $3, 'queued', 0, NOW()) RETURNING id
      `, [user.id, user.deposit_address, formattedAmount]);
      const sweepId = sweepRes.rows[0].id;

      try {
        console.log(`[Sweep] Sweeping ${formattedAmount} ZHU from user ${user.id}`);
        const childWallet = hdWalletService.deriveWallet(user.derivation_index);
        
        // Fund child wallet with ETH if needed
        const ethBalance = await provider.getBalance(user.deposit_address);
        const minEth = ethers.parseEther('0.0001');
        
        if (ethBalance < minEth) {
          console.log(`[Sweep] Funding child wallet ${user.deposit_address} with ETH`);
          const fundTx = await treasuryWallet.sendTransaction({
            to: user.deposit_address,
            value: minEth - ethBalance
          });
          await fundTx.wait();
        }

        await db.query("UPDATE sweeps SET status = 'processing' WHERE id = $1", [sweepId]);
        const childContract = hdWalletService.getZhuContract(childWallet);
        const tx = await childContract.transfer(treasuryAddress, balance);
        
        await db.query("UPDATE sweeps SET status = 'broadcast', tx_hash = $1 WHERE id = $2", [tx.hash, sweepId]);
        await tx.wait();
        await db.query("UPDATE sweeps SET status = 'confirmed' WHERE id = $1", [sweepId]);
        console.log(`[Sweep] Sweep ${sweepId} confirmed. txHash: ${tx.hash}`);

      } catch (err) {
        console.error(`[Sweep] Failed sweep ${sweepId}:`, err);
        await db.query(`
          UPDATE sweeps 
          SET status = 'failed', error_message = $1, retry_count = retry_count + 1 
          WHERE id = $2
        `, [err.message, sweepId]);
      }
    }
    
    // Retry failed sweeps
    const failedRes = await db.query("SELECT id FROM sweeps WHERE status = 'failed' AND retry_count < 3");
    if (failedRes.rows.length > 0) {
      console.log(`[Sweep] Retrying ${failedRes.rows.length} failed sweeps...`);
      await db.query("UPDATE sweeps SET status = 'queued' WHERE status = 'failed' AND retry_count < 3");
    }

  } finally {
    isSweeping = false;
  }
}

module.exports = {
  startSweepService,
  stopSweepService,
  sweepAll
};
