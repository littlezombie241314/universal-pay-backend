const express = require('express');
const router = express.Router();
const { AlipaySdk } = require('alipay-sdk');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

// 初始化支付宝SDK
let alipaySdk = null;
function getAlipaySdk() {
  if (!alipaySdk) {
    if (!config.alipay.appId || config.alipay.appId === 'your_alipay_app_id') {
      throw new Error('支付宝未配置，请在.env中设置ALIPAY_APP_ID等参数');
    }
    const sdkConfig = {
      appId: config.alipay.appId,
      privateKey: config.alipay.privateKey,
      keyType: 'PKCS8',
      gateway: config.alipay.gateway,
      signType: config.alipay.signType,
    };
    if (config.alipay.useCert && config.alipay.appCertPath) {
      // 公钥证书模式（使用绝对路径）
      const path = require('path');
      sdkConfig.appCertPath = path.resolve(config.alipay.appCertPath);
      sdkConfig.alipayPublicCertPath = path.resolve(config.alipay.alipayCertPath);
      sdkConfig.alipayRootCertPath = path.resolve(config.alipay.alipayRootCertPath);
    } else {
      // 普通公钥模式
      sdkConfig.alipayPublicKey = config.alipay.publicKey;
    }
    alipaySdk = new AlipaySdk(sdkConfig);
  }
  return alipaySdk;
}

/**
 * 支付宝单笔转账到支付宝账户
 * 接口：alipay.fund.trans.uni.transfer
 * 文档：https://opendocs.alipay.com/open/02byuo
 * 需要签约：转账到支付宝账户
 */
router.post('/transfer', async (req, res) => {
  try {
    const { payeeAccount, payeeName, amount, remark, orderTitle } = req.body;

    // 参数校验
    if (!payeeAccount) {
      return res.status(400).json({ success: false, code: 'PARAM_ERROR', message: '收款账户不能为空' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, code: 'PARAM_ERROR', message: '转账金额必须大于0' });
    }
    if (amount > 50000) {
      return res.status(400).json({ success: false, code: 'PARAM_ERROR', message: '单笔转账金额不能超过50000元' });
    }

    const sdk = getAlipaySdk();
    const outBizNo = uuidv4().replace(/-/g, '').substring(0, 32);

    // 识别收款账户类型
    let identityType = 'ALIPAY_LOGON_ID';
    if (/^\d{16,20}$/.test(payeeAccount)) {
      identityType = 'ALIPAY_USER_ID';
    } else if (/^1\d{10}$/.test(payeeAccount)) {
      identityType = 'ALIPAY_LOGON_ID';
    }

    const result = await sdk.exec('alipay.fund.trans.uni.transfer', {
      bizContent: {
        out_biz_no: outBizNo,
        trans_amount: Number(amount).toFixed(2),
        product_code: 'SALES_TO_ACCOUNT',
        payee_info: {
          identity: payeeAccount,
          identity_type: identityType,
          name: payeeName || '',
        },
        remark: remark || '全球工资发放',
        order_title: orderTitle || '全民基本收入发放',
      },
    });

    // 检查支付宝业务错误码
    if (result.code !== '10000') {
      logger.error('支付宝转账业务失败', { outBizNo, payeeAccount, amount, code: result.code, subCode: result.subCode, subMsg: result.subMsg });
      return res.status(400).json({
        success: false,
        code: result.subCode || result.code,
        message: result.subMsg || result.msg || '支付宝转账失败',
        detail: result,
      });
    }

    logger.info('支付宝转账成功', { outBizNo, payeeAccount, amount, orderId: result.order_id });

    res.json({
      success: true,
      data: {
        outBizNo,
        orderId: result.order_id,
        payFundOrderId: result.pay_fund_order_id,
        status: result.status || 'SUCCESS',
        amount: Number(amount).toFixed(2),
        transDate: result.trans_date,
      },
      message: '转账成功',
    });
  } catch (error) {
    logger.error('支付宝转账失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      code: 'ALIPAY_ERROR',
      message: error.message || '支付宝转账失败',
    });
  }
});

/**
 * 查询转账订单状态
 * 接口：alipay.fund.trans.common.query
 */
router.post('/query', async (req, res) => {
  try {
    const { outBizNo, orderId } = req.body;
    if (!outBizNo && !orderId) {
      return res.status(400).json({ success: false, message: 'outBizNo或orderId不能为空' });
    }

    const sdk = getAlipaySdk();
    const bizContent = {};
    if (outBizNo) bizContent.out_biz_no = outBizNo;
    if (orderId) bizContent.order_id = orderId;

    const result = await sdk.exec('alipay.fund.trans.common.query', { bizContent });

    res.json({
      success: true,
      data: {
        status: result.status,
        payDate: result.pay_date,
        arrivalTimeEnd: result.arrival_time_end,
        orderId: result.order_id,
        outBizNo: result.out_biz_no,
        transAmount: result.trans_amount,
      },
    });
  } catch (error) {
    logger.error('支付宝查询失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 支付宝账户余额查询
 * 接口：alipay.fund.account.query
 */
router.post('/balance', async (req, res) => {
  try {
    const sdk = getAlipaySdk();
    const result = await sdk.exec('alipay.fund.account.query', {
      bizContent: {
        alipay_user_id: config.alipay.appId,
        account_type: 'ACCTRANS_ACCOUNT',
      },
    });

    res.json({
      success: true,
      data: {
        availableAmount: result.available_amount,
        freezeAmount: result.freeze_amount,
        accountType: result.account_type,
      },
    });
  } catch (error) {
    logger.error('支付宝余额查询失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 批量转账（串行处理，避免并发限制）
 */
router.post('/batch-transfer', async (req, res) => {
  try {
    const { transfers } = req.body;
    if (!Array.isArray(transfers) || transfers.length === 0) {
      return res.status(400).json({ success: false, message: '转账列表不能为空' });
    }
    if (transfers.length > 100) {
      return res.status(400).json({ success: false, message: '单次批量转账不能超过100笔' });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of transfers) {
      try {
        const sdk = getAlipaySdk();
        const outBizNo = uuidv4().replace(/-/g, '').substring(0, 32);
        const result = await sdk.exec('alipay.fund.trans.uni.transfer', {
          bizContent: {
            out_biz_no: outBizNo,
            trans_amount: Number(item.amount).toFixed(2),
            product_code: 'SALES_TO_ACCOUNT',
            payee_info: {
              identity: item.payeeAccount,
              identity_type: /^\d{16,20}$/.test(item.payeeAccount) ? 'ALIPAY_USER_ID' : 'ALIPAY_LOGON_ID',
              name: item.payeeName || '',
            },
            remark: item.remark || '全球工资发放',
          },
        });
        results.push({ outBizNo, success: true, amount: item.amount, payeeAccount: item.payeeAccount });
        successCount++;
      } catch (err) {
        results.push({ success: false, error: err.message, payeeAccount: item.payeeAccount });
        failCount++;
      }
    }

    res.json({
      success: true,
      data: {
        total: transfers.length,
        successCount,
        failCount,
        results,
      },
      message: `批量转账完成：成功${successCount}笔，失败${failCount}笔`,
    });
  } catch (error) {
    logger.error('支付宝批量转账失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
