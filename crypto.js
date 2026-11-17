/**
 * 全宇宙恒等系统 - 加密货币真实转账模块（TRON TRC20 + Ethereum ERC20）
 * 真实链上转账：以系统真实钱包（助记词派生）的链上真实资产为准，
 * 余额不足或链上失败时如实报错，绝不伪装成功。
 *
 * 环境变量：
 *   CRYPTO_MNEMONIC=  BIP39 助记词（TRON 与 EVM 钱包均由此派生，敏感勿外泄）
 *   TRON_RPC=         默认 https://api.trongrid.io
 *   ETH_RPC=          默认 https://ethereum.publicnode.com
 */
const { ethers } = require('ethers');
const TronWebMod = require('tronweb');
const TronWeb = TronWebMod.TronWeb || TronWebMod.default;

const MNEMONIC = (process.env.CRYPTO_MNEMONIC || '').trim();
const TRON_RPC = process.env.TRON_RPC || 'https://api.trongrid.io';
const ETH_RPC = process.env.ETH_RPC || 'https://ethereum.publicnode.com';

// 合约地址
const USDT_TRC20 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const USDT_ERC20 = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

const isHex = (s) => /^0x[0-9a-fA-F]{40}$/.test(s || '');
const isBase58 = (s) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s || '');

function getWallets() {
  if (!MNEMONIC) return null;
  const tronHD = ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, "m/44'/195'/0'/0/0");
  const tronPriv = tronHD.privateKey.replace(/^0x/, '');
  const tron = new TronWeb({
    fullNode: TRON_RPC,
    solidityNode: TRON_RPC,
    eventServer: TRON_RPC,
    privateKey: tronPriv,
  });
  const evm = ethers.Wallet.fromPhrase(MNEMONIC);
  return { tron, tronAddress: tron.defaultAddress.base58, evm, evmAddress: evm.address };
}

/** 查询余额（两条链） */
async function getBalances() {
  const w = getWallets();
  if (!w) return { configured: false };
  const out = { configured: true, tronAddress: w.tronAddress, evmAddress: w.evmAddress };
  try {
    const trx = await w.tron.trx.getBalance(w.tronAddress);
    out.trx = Number(trx) / 1e6;
  } catch (e) { out.trx = null; }
  try {
    const c = await w.tron.contract().at(USDT_TRC20);
    const r = await c.balanceOf(w.tronAddress).call();
    out.usdtTrc20 = Number(r) / 1e6;
  } catch (e) { out.usdtTrc20 = null; }
  const provider = new ethers.JsonRpcProvider(ETH_RPC);
  try {
    out.eth = ethers.formatEther(await provider.getBalance(w.evmAddress));
  } catch (e) { out.eth = null; }
  try {
    const abi = ['function balanceOf(address) view returns (uint256)'];
    const c = new ethers.Contract(USDT_ERC20, abi, provider);
    const r = await c.balanceOf(w.evmAddress);
    out.usdtErc20 = ethers.formatUnits(r, 6);
  } catch (e) { out.usdtErc20 = null; }
  return out;
}

/** 真实转账（签名并广播上链） */
async function transfer({ chain, to, amount, token }) {
  const w = getWallets();
  if (!w) return { success: false, message: 'CRYPTO_MNEMONIC 未配置' };
  if (!amount || Number(amount) <= 0) return { success: false, message: '金额无效' };
  const amt = Number(amount);

  if (chain === 'tron') {
    if (!isBase58(to)) return { success: false, message: 'TRON 地址格式无效' };
    const trx = await w.tron.trx.getBalance(w.tronAddress);
    if (token === 'native') {
      if (trx < Math.ceil(amt * 1e6)) return { success: false, message: 'TRX 链上余额不足（含转账所需能量费）' };
      const t = await w.tron.trx.sendTransaction(to, Math.floor(amt * 1e6));
      return { success: true, chain: 'tron', token: 'trx', txid: t.txid || t.transaction?.txID || '', message: 'TRX 真实转账已广播上链' };
    }
    // USDT-TRC20
    if (token !== 'usdt') return { success: false, message: 'TRON 链仅支持 USDT(TRC20) 或 TRX' };
    const usdt = await w.tron.contract().at(USDT_TRC20);
    const bal = await usdt.balanceOf(w.tronAddress).call();
    if (Number(bal) < Math.floor(amt * 1e6)) return { success: false, message: 'USDT-TRC20 链上余额不足' };
    if (trx < 10 * 1e6) return { success: false, message: 'TRX 余额不足（转账需约 10 TRX 能量费）' };
    const t = await usdt.transfer(to, BigInt(Math.floor(amt * 1e6))).send({ feeLimit: 30 * 1e6 });
    return { success: true, chain: 'tron', token: 'usdt', txid: t.txid || t.transaction?.txID || '', message: 'USDT-TRC20 真实转账已广播上链' };
  }

  if (chain === 'eth') {
    if (!isHex(to)) return { success: false, message: 'EVM 地址格式无效' };
    const provider = new ethers.JsonRpcProvider(ETH_RPC);
    const signer = w.evm.connect(provider);
    if (token === 'native') {
      const bal = await provider.getBalance(w.evmAddress);
      if (bal < ethers.parseEther(amt.toFixed(6)) + ethers.parseEther('0.001'))
        return { success: false, message: 'ETH 链上余额不足（含 gas 费）' };
      const tx = await signer.sendTransaction({ to, value: ethers.parseEther(amt.toFixed(6)) });
      await tx.wait();
      return { success: true, chain: 'eth', token: 'eth', txid: tx.hash, message: 'ETH 真实转账已上链确认' };
    }
    if (token !== 'usdt') return { success: false, message: 'ETH 链仅支持 USDT(ERC20) 或 ETH' };
    const abi = ['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)'];
    const c = new ethers.Contract(USDT_ERC20, abi, signer);
    const bal = await c.balanceOf(w.evmAddress);
    if (bal < ethers.parseUnits(amt.toFixed(6), 6)) return { success: false, message: 'USDT-ERC20 链上余额不足' };
    const ethBal = await provider.getBalance(w.evmAddress);
    if (ethBal < ethers.parseEther('0.005')) return { success: false, message: 'ETH 余额不足（ERC20 转账需 ETH 作 gas）' };
    const tx = await c.transfer(to, ethers.parseUnits(amt.toFixed(6), 6));
    await tx.wait();
    return { success: true, chain: 'eth', token: 'usdt', txid: tx.hash, message: 'USDT-ERC20 真实转账已上链确认' };
  }

  return { success: false, message: 'chain 仅支持 tron / eth' };
}

module.exports = { getBalances, transfer };
