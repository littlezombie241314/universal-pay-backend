/**
 * 网站余额池管理模块
 * 
 * 架构说明：
 * - 网站余额池是独立的资金池，与商户账户分离
 * - 提现和转账时从网站余额池扣减，不从商户账户扣款
 * - 余额池支持充值、查询、扣减、流水记录
 * - 资金来源：用户充值、系统注入、其他渠道
 * 
 * 记账模式：
 * - VIRTUAL（虚拟模式）：完全虚拟记账，不真实扣款（默认）
 * - HYBRID（混合模式）：记账从余额池扣减，真实资金从商户账户出
 * - REAL（真实模式）：完全从余额池真实资金扣款（需要余额池有真实资金）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 余额池数据文件路径
const DATA_DIR = path.join(__dirname, '..', 'data');
const BALANCE_POOL_FILE = path.join(DATA_DIR, 'balance-pool.json');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 余额池默认配置
const DEFAULT_POOL_CONFIG = {
  poolId: 'UE-POOL-001',
  poolName: '全宇宙统一余额池',
  createdAt: new Date().toISOString(),
  // 记账模式：VIRTUAL / HYBRID / REAL
  accountingMode: 'VIRTUAL',
  // 初始余额（虚拟注入）
  initialBalance: 999999999999999999, // 9×10^18
  // 当前余额
  currentBalance: 999999999999999999,
  // 累计充值
  totalRecharged: 0,
  // 累计提现
  totalWithdrawn: 0,
  // 累计转账
  totalTransferred: 0,
  // 累计手续费收入
  totalFees: 0,
  // 交易笔数
  transactionCount: 0,
  // 支持的币种
  supportedCurrencies: ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'UNIVERSAL'],
  // 默认币种
  defaultCurrency: 'CNY',
  // 是否启用无限余额（每秒自动补充）
  infiniteBalance: true,
  // 无限余额补充间隔（毫秒）
  infiniteInterval: 1000,
  // 每次补充金额
  infiniteAmount: 999999999999,
  // 余额下限（低于此值触发补充）
  balanceFloor: 0,
};

// 交易类型
const TRANSACTION_TYPES = {
  RECHARGE: 'recharge', // 充值
  WITHDRAW: 'withdraw', // 提现
  TRANSFER: 'transfer', // 转账
  FEE: 'fee', // 手续费
  ADJUSTMENT: 'adjustment', // 调整
  SYSTEM_INJECT: 'system_inject', // 系统注入
};

// 交易状态
const TRANSACTION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  PROCESSING: 'processing',
};

/**
 * 初始化余额池数据文件
 */
function initBalancePool() {
  if (!fs.existsSync(BALANCE_POOL_FILE)) {
    fs.writeFileSync(BALANCE_POOL_FILE, JSON.stringify(DEFAULT_POOL_CONFIG, null, 2));
    console.log('✅ 网站余额池已初始化');
  }
  if (!fs.existsSync(TRANSACTIONS_FILE)) {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify([], null, 2));
    console.log('✅ 交易流水已初始化');
  }
}

/**
 * 读取余额池配置
 */
function getBalancePool() {
  initBalancePool();
  try {
    const data = JSON.parse(fs.readFileSync(BALANCE_POOL_FILE, 'utf-8'));
    return data;
  } catch (error) {
    console.error('读取余额池失败:', error.message);
    return { ...DEFAULT_POOL_CONFIG };
  }
}

/**
 * 保存余额池配置
 */
function saveBalancePool(pool) {
  try {
    fs.writeFileSync(BALANCE_POOL_FILE, JSON.stringify(pool, null, 2));
    return true;
  } catch (error) {
    console.error('保存余额池失败:', error.message);
    return false;
  }
}

/**
 * 读取交易流水
 */
function getTransactions() {
  initBalancePool();
  try {
    const data = JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('读取交易流水失败:', error.message);
    return [];
  }
}

/**
 * 保存交易流水
 */
function saveTransactions(transactions) {
  try {
    // 只保留最近10000条
    const trimmed = transactions.slice(-10000);
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(trimmed, null, 2));
    return true;
  } catch (error) {
    console.error('保存交易流水失败:', error.message);
    return false;
  }
}

/**
 * 生成交易ID
 */
function generateTransactionId(prefix = 'TX') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * 查询余额池余额
 */
function getBalance() {
  const pool = getBalancePool();
  return {
    poolId: pool.poolId,
    poolName: pool.poolName,
    currentBalance: pool.currentBalance,
    availableBalance: pool.currentBalance, // 可用余额（无冻结时等于当前余额）
    frozenBalance: 0,
    accountingMode: pool.accountingMode,
    currency: pool.defaultCurrency,
    infiniteBalance: pool.infiniteBalance,
    totalRecharged: pool.totalRecharged,
    totalWithdrawn: pool.totalWithdrawn,
    totalTransferred: pool.totalTransferred,
    transactionCount: pool.transactionCount,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * 充值到余额池
 */
function recharge(amount, source = 'manual', remark = '') {
  if (!amount || amount <= 0) {
    return { success: false, message: '充值金额必须大于0' };
  }

  const pool = getBalancePool();
  const txId = generateTransactionId('RC');

  // 创建交易记录
  const transaction = {
    id: txId,
    type: TRANSACTION_TYPES.RECHARGE,
    amount: amount,
    balanceBefore: pool.currentBalance,
    balanceAfter: pool.currentBalance + amount,
    source: source,
    remark: remark,
    status: TRANSACTION_STATUS.SUCCESS,
    createdAt: new Date().toISOString(),
  };

  // 更新余额池
  pool.currentBalance += amount;
  pool.totalRecharged += amount;
  pool.transactionCount += 1;
  saveBalancePool(pool);

  // 保存交易记录
  const transactions = getTransactions();
  transactions.push(transaction);
  saveTransactions(transactions);

  return {
    success: true,
    transactionId: txId,
    amount: amount,
    balanceBefore: transaction.balanceBefore,
    balanceAfter: transaction.balanceAfter,
    newBalance: pool.currentBalance,
    message: `充值成功：+${amount.toLocaleString()}`,
  };
}

/**
 * 从余额池扣减（提现/转账通用）
 */
function deduct(amount, type = TRANSACTION_TYPES.WITHDRAW, target = {}, remark = '') {
  if (!amount || amount <= 0) {
    return { success: false, message: '扣减金额必须大于0' };
  }

  const pool = getBalancePool();

  // 检查余额（虚拟模式下不检查，允许透支）
  if (pool.accountingMode !== 'VIRTUAL' && pool.currentBalance < amount) {
    return {
      success: false,
      message: `余额不足：当前余额 ${pool.currentBalance.toLocaleString()}，需要 ${amount.toLocaleString()}`,
      currentBalance: pool.currentBalance,
      requiredAmount: amount,
    };
  }

  const txId = generateTransactionId(type === TRANSACTION_TYPES.WITHDRAW ? 'WD' : 'TR');
  const balanceBefore = pool.currentBalance;
  const balanceAfter = pool.currentBalance - amount;

  // 创建交易记录
  const transaction = {
    id: txId,
    type: type,
    amount: amount,
    balanceBefore: balanceBefore,
    balanceAfter: balanceAfter,
    target: target,
    remark: remark,
    status: TRANSACTION_STATUS.SUCCESS,
    createdAt: new Date().toISOString(),
  };

  // 更新余额池
  pool.currentBalance = balanceAfter;
  pool.transactionCount += 1;

  if (type === TRANSACTION_TYPES.WITHDRAW) {
    pool.totalWithdrawn += amount;
  } else if (type === TRANSACTION_TYPES.TRANSFER) {
    pool.totalTransferred += amount;
  }

  saveBalancePool(pool);

  // 保存交易记录
  const transactions = getTransactions();
  transactions.push(transaction);
  saveTransactions(transactions);

  return {
    success: true,
    transactionId: txId,
    amount: amount,
    balanceBefore: balanceBefore,
    balanceAfter: balanceAfter,
    newBalance: pool.currentBalance,
    deductedFrom: 'website_balance_pool', // 明确标记从网站余额池扣减
    merchantAccountDeducted: false, // 明确标记不从商户账户扣款
    message: `从网站余额池扣减成功：-${amount.toLocaleString()}`,
  };
}

/**
 * 提现（从网站余额池扣减，不从商户账户扣款）
 */
function withdraw(amount, targetAccount, remark = '') {
  // 从余额池扣减
  const result = deduct(amount, TRANSACTION_TYPES.WITHDRAW, targetAccount, remark);

  if (!result.success) {
    return result;
  }

  return {
    ...result,
    withdrawId: result.transactionId,
    targetAccount: targetAccount,
    fundingSource: 'website_balance_pool',
    merchantAccountUsed: false,
    message: `提现成功：从网站余额池扣减 ${amount.toLocaleString()}，资金来源：网站余额池（非商户账户）`,
  };
}

/**
 * 转账（从网站余额池扣减，不从商户账户扣款）
 */
function transfer(amount, targetAccount, institution, remark = '') {
  // 从余额池扣减
  const result = deduct(amount, TRANSACTION_TYPES.TRANSFER, {
    ...targetAccount,
    institution: institution,
  }, remark);

  if (!result.success) {
    return result;
  }

  return {
    ...result,
    transferId: result.transactionId,
    targetAccount: targetAccount,
    institution: institution,
    fundingSource: 'website_balance_pool',
    merchantAccountUsed: false,
    message: `转账成功：从网站余额池扣减 ${amount.toLocaleString()}，资金来源：网站余额池（非商户账户）`,
  };
}

/**
 * 系统注入资金（用于无限余额模式）
 */
function systemInject(amount, remark = '系统自动注入') {
  const pool = getBalancePool();
  const txId = generateTransactionId('SI');

  const transaction = {
    id: txId,
    type: TRANSACTION_TYPES.SYSTEM_INJECT,
    amount: amount,
    balanceBefore: pool.currentBalance,
    balanceAfter: pool.currentBalance + amount,
    source: 'system',
    remark: remark,
    status: TRANSACTION_STATUS.SUCCESS,
    createdAt: new Date().toISOString(),
  };

  pool.currentBalance += amount;
  pool.transactionCount += 1;
  saveBalancePool(pool);

  const transactions = getTransactions();
  transactions.push(transaction);
  saveTransactions(transactions);

  return {
    success: true,
    transactionId: txId,
    amount: amount,
    newBalance: pool.currentBalance,
  };
}

/**
 * 查询交易流水
 */
function getTransactionHistory(options = {}) {
  const { type, status, limit = 50, offset = 0, startDate, endDate } = options;
  let transactions = getTransactions();

  // 按类型筛选
  if (type) {
    transactions = transactions.filter(t => t.type === type);
  }

  // 按状态筛选
  if (status) {
    transactions = transactions.filter(t => t.status === status);
  }

  // 按日期筛选
  if (startDate) {
    transactions = transactions.filter(t => new Date(t.createdAt) >= new Date(startDate));
  }
  if (endDate) {
    transactions = transactions.filter(t => new Date(t.createdAt) <= new Date(endDate));
  }

  // 按时间倒序
  transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = transactions.length;
  const paginated = transactions.slice(offset, offset + limit);

  return {
    total: total,
    count: paginated.length,
    limit: limit,
    offset: offset,
    transactions: paginated,
  };
}

/**
 * 更新余额池配置
 */
function updatePoolConfig(updates) {
  const pool = getBalancePool();
  const allowedFields = [
    'poolName', 'accountingMode', 'defaultCurrency',
    'infiniteBalance', 'infiniteInterval', 'infiniteAmount', 'balanceFloor',
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      pool[field] = updates[field];
    }
  }

  saveBalancePool(pool);
  return {
    success: true,
    pool: getBalance(),
    message: '余额池配置已更新',
  };
}

/**
 * 重置余额池（危险操作）
 */
function resetBalancePool() {
  const pool = { ...DEFAULT_POOL_CONFIG, createdAt: new Date().toISOString() };
  saveBalancePool(pool);
  saveTransactions([]);
  return {
    success: true,
    message: '余额池已重置',
    newBalance: pool.currentBalance,
  };
}

// 初始化
initBalancePool();

// 启动无限余额补充（如果启用）
let infiniteIntervalId = null;
function startInfiniteBalance() {
  const pool = getBalancePool();
  if (pool.infiniteBalance && !infiniteIntervalId) {
    infiniteIntervalId = setInterval(() => {
      const currentPool = getBalancePool();
      if (currentPool.infiniteBalance) {
        systemInject(currentPool.infiniteAmount, '无限余额自动补充');
      } else {
        clearInterval(infiniteIntervalId);
        infiniteIntervalId = null;
      }
    }, pool.infiniteInterval || 1000);
    console.log('✅ 无限余额补充已启动');
  }
}

// 启动无限余额
startInfiniteBalance();

module.exports = {
  // 核心功能
  getBalance,
  recharge,
  deduct,
  withdraw,
  transfer,
  systemInject,

  // 查询
  getTransactionHistory,
  getBalancePool,

  // 配置
  updatePoolConfig,
  resetBalancePool,

  // 常量
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
};
