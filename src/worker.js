const db = require('./db');
const hdWalletService = require('./services/hdWalletService');
const blockchainScanner = require('./services/blockchainScanner');
const sweepService = require('./services/sweepService');
const withdrawalService = require('./services/withdrawalService');

async function startWorker() {
  console.log('[Worker] Starting dedicated background worker...');
  try {
    await db.initDb();
    const treasuryAddress = hdWalletService.getTreasuryAddress();
    console.log('[Worker] Treasury Address:', treasuryAddress);

    blockchainScanner.startScanner();
    sweepService.startSweepService();
    withdrawalService.startWithdrawalService();

    console.log('[Worker] All background services (Scanner, Sweeper, Withdrawal) running 24/7.');
  } catch (err) {
    console.error('[Worker] Fatal startup error:', err);
    process.exit(1);
  }
}

startWorker();
