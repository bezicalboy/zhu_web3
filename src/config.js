require('dotenv').config();

const config = {
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zhu_platform',

  // HD Wallet
  masterMnemonic: process.env.MASTER_MNEMONIC,
  treasuryIndex: parseInt(process.env.TREASURY_INDEX || '0', 10),

  // Blockchain (Base Sepolia)
  rpcUrl: process.env.RPC_URL || 'https://sepolia.base.org',
  zhuContractAddress: process.env.ZHU_CONTRACT_ADDRESS,
  chainId: parseInt(process.env.CHAIN_ID || '84532', 10),
  requiredConfirmations: parseInt(process.env.REQUIRED_CONFIRMATIONS || '3', 10),

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: '7d',

  // Service intervals
  scannerIntervalMs: parseInt(process.env.SCANNER_INTERVAL_MS || '15000', 10),
  sweepIntervalMs: parseInt(process.env.SWEEP_INTERVAL_MS || '1800000', 10),
  withdrawalIntervalMs: parseInt(process.env.WITHDRAWAL_INTERVAL_MS || '60000', 10),

  // Limits
  minDepositAmount: process.env.MIN_DEPOSIT_AMOUNT || '1',
  minWithdrawalAmount: process.env.MIN_WITHDRAWAL_AMOUNT || '1',

  // Server
  port: parseInt(process.env.PORT || '3000', 10),

  // ERC20 ABI (Transfer event + transfer function)
  erc20Abi: [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
  ],
};

module.exports = config;
