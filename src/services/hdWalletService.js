const { ethers } = require('ethers');
const config = require('../config');
const db = require('../db');

let provider = null;
let masterNode = null;

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.rpcUrl, Number(config.chainId));
  }
  return provider;
}

function getMasterNode() {
  if (!masterNode) {
    // Derive to m/44'/60'/0'/0 (account level) so child derivation is just the index
    masterNode = ethers.HDNodeWallet.fromPhrase(
      config.masterMnemonic,
      "",                  // no password
      "m/44'/60'/0'/0"     // stop at account level
    );
  }
  return masterNode;
}

function deriveAddress(index) {
  const node = getMasterNode().deriveChild(index);
  return node.address;
}

function deriveWallet(index) {
  const node = getMasterNode().deriveChild(index);
  return new ethers.Wallet(node.privateKey, getProvider());
}

function getTreasuryWallet() {
  return deriveWallet(config.treasuryIndex);
}

function getTreasuryAddress() {
  return deriveAddress(config.treasuryIndex);
}

async function getNextDerivationIndex() {
  const res = await db.query('SELECT MAX(derivation_index) as max_idx FROM users');
  const maxIdx = res.rows[0].max_idx;
  return maxIdx !== null ? parseInt(maxIdx, 10) + 1 : 1;
}

function getZhuContract(signerOrProvider) {
  return new ethers.Contract(config.zhuContractAddress, config.erc20Abi, signerOrProvider);
}

module.exports = {
  getProvider,
  getMasterNode,
  deriveAddress,
  deriveWallet,
  getTreasuryWallet,
  getTreasuryAddress,
  getNextDerivationIndex,
  getZhuContract,
};
