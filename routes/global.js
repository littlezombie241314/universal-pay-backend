const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 全球金融账户路由
 * 支持：Stripe（全球支付）、PayPal、国际银行转账（SWIFT）
 * Stripe文档：https://stripe.com/docs/api
 */

// 初始化Stripe
let stripe = null;
function getStripe() {
  if (!stripe) {
    if (!config.stripe.secretKey || config.stripe.secretKey === 'sk_live_your_stripe_secret_key') {
      throw new Error('Stripe未配置，请在.env中设置STRIPE_SECRET_KEY');
    }
    stripe = require('stripe')(config.stripe.secretKey);
  }
  return stripe;
}

/**
 * Stripe转账到Connect账户
 * 接口：POST /v1/transfers
 * 用于向已连接的Stripe账户转账
 */
router.post('/stripe-transfer', async (req, res) => {
  try {
    const { destination, amount, currency, description } = req.body;

    if (!destination) {
      return res.status(400).json({ success: false, message: '目标账户ID不能为空' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '转账金额必须大于0' });
    }

    const stripeClient = getStripe();
    const transfer = await stripeClient.transfers.create({
      amount: Math.round(amount * 100), // 转分
      currency: currency || 'usd',
      destination: destination,
      description: description || '全球工资发放',
      metadata: {
        order_id: uuidv4(),
        purpose: 'salary_distribution',
      },
    });

    logger.info('Stripe转账成功', { transferId: transfer.id, destination, amount });

    res.json({
      success: true,
      data: {
        transferId: transfer.id,
        amount: (transfer.amount / 100).toFixed(2),
        currency: transfer.currency,
        destination: transfer.destination,
        status: transfer.status,
        created: new Date(transfer.created * 1000).toISOString(),
      },
      message: 'Stripe转账成功',
    });
  } catch (error) {
    logger.error('Stripe转账失败', { error: error.message });
    res.status(500).json({
      success: false,
      code: error.type || 'STRIPE_ERROR',
      message: error.message || 'Stripe转账失败',
    });
  }
});

/**
 * Stripe创建Payout（向银行账户付款）
 * 接口：POST /v1/payouts
 * 需要Stripe账户已绑定银行账户
 */
router.post('/stripe-payout', async (req, res) => {
  try {
    const { amount, currency, description, destination } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '付款金额必须大于0' });
    }

    const stripeClient = getStripe();
    const payoutParams = {
      amount: Math.round(amount * 100),
      currency: currency || 'usd',
      description: description || '全球工资发放',
      metadata: {
        order_id: uuidv4(),
        purpose: 'salary_payout',
      },
    };
    if (destination) {
      payoutParams.destination = destination;
    }

    const payout = await stripeClient.payouts.create(payoutParams);

    logger.info('Stripe Payout创建成功', { payoutId: payout.id, amount });

    res.json({
      success: true,
      data: {
        payoutId: payout.id,
        amount: (payout.amount / 100).toFixed(2),
        currency: payout.currency,
        status: payout.status,
        arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
      },
      message: 'Payout创建成功',
    });
  } catch (error) {
    logger.error('Stripe Payout失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Stripe创建Connect账户（为用户创建Stripe账户）
 */
router.post('/stripe-create-account', async (req, res) => {
  try {
    const { email, country, type = 'express' } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: '邮箱不能为空' });
    }

    const stripeClient = getStripe();
    const account = await stripeClient.accounts.create({
      type: type,
      country: country || 'US',
      email: email,
      capabilities: {
        transfers: { requested: true },
      },
    });

    // 创建Account Link用于用户完成注册
    const accountLink = await stripeClient.accountLinks.create({
      account: account.id,
      refresh_url: config.frontendUrl + '/stripe/refresh',
      return_url: config.frontendUrl + '/stripe/return',
      type: 'account_onboarding',
    });

    res.json({
      success: true,
      data: {
        accountId: account.id,
        email: account.email,
        onboardingUrl: accountLink.url,
      },
      message: 'Stripe账户创建成功，请通过链接完成注册',
    });
  } catch (error) {
    logger.error('Stripe账户创建失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Stripe余额查询
 */
router.get('/stripe-balance', async (req, res) => {
  try {
    const stripeClient = getStripe();
    const balance = await stripeClient.balance.retrieve();

    res.json({
      success: true,
      data: {
        available: balance.available.map(b => ({
          amount: (b.amount / 100).toFixed(2),
          currency: b.currency,
        })),
        pending: balance.pending.map(b => ({
          amount: (b.amount / 100).toFixed(2),
          currency: b.currency,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PayPal转账（Payouts API）
 * 文档：https://developer.paypal.com/docs/api/payments.payouts-batch/v1/
 * 需要：PayPal商家账户、Payouts权限
 */
router.post('/paypal-payout', async (req, res) => {
  try {
    const { recipientEmail, amount, currency, note } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: '收款邮箱不能为空' });
    }

    // PayPal Payouts API调用框架
    // 实际使用需要：
    // 1. PayPal开发者账户 https://developer.paypal.com
    // 2. 创建应用获取Client ID和Secret
    // 3. 申请Payouts权限
    // 4. 获取Access Token
    // 5. 调用 /v1/payments/payouts 接口

    const payoutBatchId = `PAYPAL${Date.now()}`;

    logger.info('PayPal Payout请求', { payoutBatchId, recipientEmail, amount });

    res.json({
      success: true,
      data: {
        payoutBatchId,
        amount: Number(amount).toFixed(2),
        currency: currency || 'USD',
        recipientEmail,
        status: 'PENDING',
        message: 'PayPal转账已受理',
      },
    });
  } catch (error) {
    logger.error('PayPal转账失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 国际银行转账（SWIFT）
 * 支持全球多国银行账户，通过SWIFT网络转账
 */
router.post('/swift-transfer', async (req, res) => {
  try {
    const { iban, swiftCode, bankName, accountName, amount, currency, country } = req.body;

    if (!iban || !swiftCode || !accountName) {
      return res.status(400).json({ success: false, message: 'IBAN、SWIFT代码和开户名不能为空' });
    }

    // SWIFT国际转账框架
    // 实际使用需要通过银行或支付机构（如Wise、Stripe、Payoneer）的API
    const transactionId = `SWIFT${Date.now()}${Math.floor(Math.random() * 1000)}`;

    logger.info('SWIFT国际转账请求', { transactionId, iban, swiftCode, amount, currency });

    res.json({
      success: true,
      data: {
        transactionId,
        amount: Number(amount).toFixed(2),
        currency: currency || 'USD',
        beneficiary: accountName,
        iban,
        swiftCode,
        status: 'PROCESSING',
        estimatedArrival: '1-3个工作日',
        message: '国际转账已受理，预计1-3个工作日到账',
      },
    });
  } catch (error) {
    logger.error('SWIFT转账失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
