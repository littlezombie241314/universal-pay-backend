const express = require('express');
const router = express.Router();
const balancePool = require('../utils/balance-pool');
const logger = require('../utils/logger');

/**
 * 网站余额池管理API
 * 
 * 架构说明：
 * - 网站余额池是独立的资金池，与商户账户分离
 * - 提现和转账时从网站余额池扣减，不从商户账户扣款
 * - 支持充值、查询、扣减、流水记录
 * - 默认启用无限余额模式（每秒自动补充）
 */

// ============ 查询接口 ============

/**
 * GET /api/balance-pool/balance
 * 查询余额池余额
 */
router.get('/balance', (req, res) => {
  try {
    const balance = balancePool.getBalance();
    res.json({
      success: true,
      data: balance,
      message: '余额查询成功',
    });
  } catch (error) {
    logger.error('查询余额池失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/balance-pool/config
 * 查询余额池配置
 */
router.get('/config', (req, res) => {
  try {
    const pool = balancePool.getBalancePool();
    res.json({
      success: true,
      data: {
        poolId: pool.poolId,
        poolName: pool.poolName,
        accountingMode: pool.accountingMode,
        defaultCurrency: pool.defaultCurrency,
        infiniteBalance: pool.infiniteBalance,
        infiniteInterval: pool.infiniteInterval,
        infiniteAmount: pool.infiniteAmount,
        balanceFloor: pool.balanceFloor,
        supportedCurrencies: pool.supportedCurrencies,
        createdAt: pool.createdAt,
      },
    });
  } catch (error) {
    logger.error('查询余额池配置失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/balance-pool/transactions
 * 查询交易流水
 */
router.get('/transactions', (req, res) => {
  try {
    const { type, status, limit = 50, offset = 0, startDate, endDate } = req.query;

    const result = balancePool.getTransactionHistory({
      type: type,
      status: status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      startDate: startDate,
      endDate: endDate,
    });

    res.json({
      success: true,
      data: result,
      message: '交易流水查询成功',
    });
  } catch (error) {
    logger.error('查询交易流水失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/balance-pool/stats
 * 查询余额池统计
 */
router.get('/stats', (req, res) => {
  try {
    const pool = balancePool.getBalancePool();
    const transactions = balancePool.getTransactionHistory({ limit: 10000 });

    // 按类型统计
    const statsByType = {};
    for (const tx of transactions.transactions) {
      if (!statsByType[tx.type]) {
        statsByType[tx.type] = { count: 0, totalAmount: 0 };
      }
      statsByType[tx.type].count += 1;
      statsByType[tx.type].totalAmount += tx.amount;
    }

    res.json({
      success: true,
      data: {
        currentBalance: pool.currentBalance,
        totalRecharged: pool.totalRecharged,
        totalWithdrawn: pool.totalWithdrawn,
        totalTransferred: pool.totalTransferred,
        totalFees: pool.totalFees,
        transactionCount: pool.transactionCount,
        statsByType: statsByType,
        accountingMode: pool.accountingMode,
        infiniteBalance: pool.infiniteBalance,
      },
      message: '余额池统计查询成功',
    });
  } catch (error) {
    logger.error('查询余额池统计失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 操作接口 ============

/**
 * POST /api/balance-pool/recharge
 * 充值到余额池
 */
router.post('/recharge', (req, res) => {
  try {
    const { amount, source = 'manual', remark = '' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '充值金额必须大于0' });
    }

    const result = balancePool.recharge(amount, source, remark);

    logger.info('余额池充值', {
      amount: amount,
      source: source,
      transactionId: result.transactionId,
      newBalance: result.newBalance,
    });

    res.json(result);
  } catch (error) {
    logger.error('余额池充值失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/balance-pool/deduct
 * 从余额池扣减（通用）
 */
router.post('/deduct', (req, res) => {
  try {
    const { amount, type = 'adjustment', target = {}, remark = '' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '扣减金额必须大于0' });
    }

    const result = balancePool.deduct(amount, type, target, remark);

    logger.info('余额池扣减', {
      amount: amount,
      type: type,
      transactionId: result.transactionId,
      newBalance: result.newBalance,
      deductedFrom: 'website_balance_pool',
      merchantAccountDeducted: false,
    });

    res.json(result);
  } catch (error) {
    logger.error('余额池扣减失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/balance-pool/withdraw
 * 提现（从网站余额池扣减，不从商户账户扣款）
 */
router.post('/withdraw', (req, res) => {
  try {
    const { amount, targetAccount, remark = '' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '提现金额必须大于0' });
    }
    if (!targetAccount) {
      return res.status(400).json({ success: false, message: '请提供目标账户信息' });
    }

    const result = balancePool.withdraw(amount, targetAccount, remark);

    logger.info('余额池提现', {
      amount: amount,
      targetAccount: targetAccount,
      withdrawId: result.withdrawId,
      newBalance: result.newBalance,
      fundingSource: 'website_balance_pool',
      merchantAccountUsed: false,
    });

    res.json(result);
  } catch (error) {
    logger.error('余额池提现失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/balance-pool/transfer
 * 转账（从网站余额池扣减，不从商户账户扣款）
 */
router.post('/transfer', (req, res) => {
  try {
    const { amount, targetAccount, institution, remark = '' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '转账金额必须大于0' });
    }
    if (!targetAccount) {
      return res.status(400).json({ success: false, message: '请提供目标账户信息' });
    }
    if (!institution) {
      return res.status(400).json({ success: false, message: '请提供目标金融机构' });
    }

    const result = balancePool.transfer(amount, targetAccount, institution, remark);

    logger.info('余额池转账', {
      amount: amount,
      institution: institution,
      targetAccount: targetAccount,
      transferId: result.transferId,
      newBalance: result.newBalance,
      fundingSource: 'website_balance_pool',
      merchantAccountUsed: false,
    });

    res.json(result);
  } catch (error) {
    logger.error('余额池转账失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/balance-pool/system-inject
 * 系统注入资金
 */
router.post('/system-inject', (req, res) => {
  try {
    const { amount, remark = '系统手动注入' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '注入金额必须大于0' });
    }

    const result = balancePool.systemInject(amount, remark);

    logger.info('系统注入资金', {
      amount: amount,
      transactionId: result.transactionId,
      newBalance: result.newBalance,
    });

    res.json(result);
  } catch (error) {
    logger.error('系统注入资金失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 配置接口 ============

/**
 * PUT /api/balance-pool/config
 * 更新余额池配置
 */
router.put('/config', (req, res) => {
  try {
    const updates = req.body;
    const result = balancePool.updatePoolConfig(updates);

    logger.info('更新余额池配置', { updates: updates });

    res.json(result);
  } catch (error) {
    logger.error('更新余额池配置失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/balance-pool/reset
 * 重置余额池（危险操作）
 */
router.post('/reset', (req, res) => {
  try {
    const { confirm } = req.body;
    if (confirm !== 'YES_RESET_BALANCE_POOL') {
      return res.status(400).json({
        success: false,
        message: '危险操作：请传入 confirm: "YES_RESET_BALANCE_POOL" 确认重置',
      });
    }

    const result = balancePool.resetBalancePool();
    logger.warn('余额池已重置', { result: result });

    res.json(result);
  } catch (error) {
    logger.error('重置余额池失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
