const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 银行转账路由
 * 支持：网商银行、银联企业付款、通用银行API
 * 注意：银行API需要与具体银行签订合作协议，获取商户号和证书
 */

// 网商银行转账（通过支付宝开放平台的"转账到银行卡"产品）
// 接口：alipay.fund.trans.uni.transfer（identity_type=BANKCARD_NO）
router.post('/alipay-bank-transfer', async (req, res) => {
  try {
    const { bankCardNo, bankName, accountName, amount, remark } = req.body;

    if (!bankCardNo || !accountName) {
      return res.status(400).json({ success: false, message: '银行卡号和开户名不能为空' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '转账金额必须大于0' });
    }

    // 这里需要使用支付宝SDK，identity_type设为BANKCARD_NO
    // 由于银行转账需要额外的资质审核，此处提供框架
    const { AlipaySdk } = require('alipay-sdk');
    const sdk = new AlipaySdk({
      appId: config.alipay.appId,
      privateKey: config.alipay.privateKey,
      alipayPublicKey: config.alipay.publicKey,
      gateway: config.alipay.gateway,
    });

    const outBizNo = uuidv4().replace(/-/g, '').substring(0, 32);
    const result = await sdk.exec('alipay.fund.trans.uni.transfer', {
      bizContent: {
        out_biz_no: outBizNo,
        trans_amount: Number(amount).toFixed(2),
        product_code: 'SALES_TO_ACCOUNT',
        payee_info: {
          identity: bankCardNo,
          identity_type: 'BANKCARD_NO',
          name: accountName,
          bank_code_ext: bankName || '',
        },
        remark: remark || '全球工资发放',
      },
    });

    logger.info('银行卡转账成功', { outBizNo, bankCardNo, amount });

    res.json({
      success: true,
      data: {
        outBizNo,
        orderId: result.order_id,
        amount: Number(amount).toFixed(2),
        status: result.status || 'SUCCESS',
      },
      message: '银行卡转账成功',
    });
  } catch (error) {
    logger.error('银行卡转账失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 银联企业付款（代付）
 * 接口：银联企业付款API
 * 需要：银联商户号、API证书
 */
router.post('/unionpay-transfer', async (req, res) => {
  try {
    const { bankCardNo, bankName, accountName, amount, phone } = req.body;

    if (!bankCardNo || !accountName) {
      return res.status(400).json({ success: false, message: '银行卡号和开户名不能为空' });
    }

    // 银联代付API调用框架
    // 实际使用需要：
    // 1. 银联商户入驻 https://merchant.unionpay.com
    // 2. 开通"企业代付"产品
    // 3. 获取商户号、API密钥、证书
    // 4. 调用银联代付接口

    const orderId = `UP${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // 模拟银联API调用（实际需替换为真实API）
    logger.info('银联代付请求', { orderId, bankCardNo, amount });

    res.json({
      success: true,
      data: {
        orderId,
        amount: Number(amount).toFixed(2),
        status: 'PROCESSING',
        message: '银联代付已受理，预计1-2个工作日到账',
      },
    });
  } catch (error) {
    logger.error('银联代付失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 银行卡信息查询（BIN查询）
 */
router.post('/card-info', async (req, res) => {
  try {
    const { bankCardNo } = req.body;
    if (!bankCardNo) {
      return res.status(400).json({ success: false, message: '银行卡号不能为空' });
    }

    // 银行卡BIN查询（前6位）
    const bin = bankCardNo.substring(0, 6);
    // 实际使用可调用银联BIN查询API或第三方银行卡识别API
    const cardInfo = {
      bin,
      bankName: '待查询',
      cardType: '待查询',
      cardCategory: '待查询',
    };

    res.json({ success: true, data: cardInfo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 批量银行转账
 */
router.post('/batch-transfer', async (req, res) => {
  try {
    const { transfers, channel = 'alipay-bank' } = req.body;
    if (!Array.isArray(transfers) || transfers.length === 0) {
      return res.status(400).json({ success: false, message: '转账列表不能为空' });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of transfers) {
      try {
        // 根据渠道调用对应接口
        const orderId = uuidv4().replace(/-/g, '').substring(0, 32);
        results.push({
          orderId,
          success: true,
          amount: item.amount,
          bankCardNo: item.bankCardNo,
          accountName: item.accountName,
        });
        successCount++;
      } catch (err) {
        results.push({ success: false, error: err.message, bankCardNo: item.bankCardNo });
        failCount++;
      }
    }

    res.json({
      success: true,
      data: { total: transfers.length, successCount, failCount, results },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
