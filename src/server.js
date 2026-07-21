require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const config = require('./config');
const db = require('./db');
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const pointsRoutes = require('./routes/points');
const referralRoutes = require('./routes/referral');
const gameRoutes = require('./routes/game');

const hdWalletService = require('./services/hdWalletService');
const blockchainScanner = require('./services/blockchainScanner');
const sweepService = require('./services/sweepService');
const withdrawalService = require('./services/withdrawalService');

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Ensure no lingering CSP header and prevent stale caching of HTML
app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  if (req.url.endsWith('.html') || req.url === '/' || !req.url.includes('.')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/game', gameRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all for SPA
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const os = require('os');

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Start server
const server = app.listen(config.port, '0.0.0.0', async () => {
  const localIp = getLocalIp();
  console.log('Server listening on port ' + config.port);
  console.log('Local Access:   http://localhost:' + config.port);
  console.log('Mobile Access:  http://' + localIp + ':' + config.port);
  console.log('Network: Base Sepolia (Chain ID: ' + config.chainId + ')');

  try {
    await db.initDb();

    const treasuryAddress = hdWalletService.getTreasuryAddress();
    console.log('Treasury Address: ' + treasuryAddress);

    // Initialize services
    blockchainScanner.startScanner();
    sweepService.startSweepService();
    withdrawalService.startWithdrawalService();
    console.log('Background services started successfully');
  } catch (err) {
    console.error('Error starting services:', err);
  }
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');

  blockchainScanner.stopScanner();
  sweepService.stopSweepService();
  withdrawalService.stopWithdrawalService();

  server.close(async () => {
    console.log('HTTP server closed');
    try {
      await db.pool.end();
      console.log('Database pool closed');
      process.exit(0);
    } catch (err) {
      console.error('Error closing database pool:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
