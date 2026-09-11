const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

// 微信支付APIv3基础配置
const WECHAT_BASE_URL = 'https://api.mch.weixin.qq.com';

// 生成请求签名（APIv3）
function generateSignature(method, urlPath, body, timestamp, nonceStr) {
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const privateKey = config.wechat.privateKey.replace(/\\n/g, '\n');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  return sign.sign(privateKey, 'base64');
}

// 生成Authorization头
function generateAuthHeader(method, urlPath, body) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = uuidv4().replace(/-/g, '');
  const signature = generateSignature(method, urlPath, body, timestamp, nonceStr);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.wechat.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${config.wechat.mchSerialNo}",signature="${signature}"`;
}

// 验证微信回调签名
function verifyWechatSignature(headers, body) {
  try {
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    const serial = headers['wechatpay-serial'];
    const message = `${timestamp}\n${nonce}\n${body}\n`;
    const cert = config.wechat.platformCert.replace(/\\n/g, '\n');
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(message);
    return verify.verify(cert, signature, 'base64');
  } catch (error) {
    logger.error('微信回调签名验证失败', { error: error.message });
    return false;
  }
}

// 解密回调资源
function decryptResource(ciphertext, associatedData, nonce) {
  const key = Buffer.from(config.wechat.apiV3Key, 'utf8');
  const aad = Buffer.from(associatedData || '', 'utf8');
  const iv = Buffer.from(nonce, 'utf8');
  const cipherBuffer = Buffer.from(ciphertext, 'base64');
  const authTag = cipherBuffer.slice(-16);
  const data = cipherBuffer.slice(0, -16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

// 检查配置
function checkConfig() {
  if (!config.wechat.mchId || config.wechat.mchId === 'your_wechat_mch_id') {
    throw new Error('微信支付未配置，请在.env中设置WECHAT_MCH_ID等参数');
  }
}

/**
 * 微信商家转账到零钱（APIv3）
 * 接口：POST /v3/transfer/batches
 * 文档：https://pay.weixin.qq.com/doc/v3/merchant/4012791854
 * 需要开通：商家转账到零钱产品
 */
router.post('/transfer', async (req, res) => {
  try {
    checkConfig();
    const { openid, amount, remark, userName } = req.body;

    if (!openid) {
      return res.status(400).json({ success: false, code: 'PARAM_ERROR', message: '用户openid不能为空' });
    }
    if (!amount || amount < 0.1) {
      return res.status(400).json({ success: false, code: 'PARAM_ERROR', message: '转账金额不能低于0.1元' });
    }
    if (amount > 2000) {
      return res.status(400).json({ success: false, code: 'PARAM_ERROR', message: '单笔转账金额不能超过2000元' });
    }

    const outBatchNo = `SALARY${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const outDetailNo = uuidv4().replace(/-/g, '').substring(0, 32);
    const totalAmount = Math.round(amount * 100); // 转分

    const body = JSON.stringify({
      out_batch_no: outBatchNo,
      batch_name: '全球工资发放',
      batch_remark: remark || '全民基本收入',
      total_amount: totalAmount,
      total_num: 1,
      transfer_detail_list: [{
        out_detail_no: outDetailNo,
        transfer_amount: totalAmount,
        transfer_remark: remark || '工资发放',
        openid: openid,
        user_name: userName || undefined,
      }],
    });

    const urlPath = '/v3/transfer/batches';
    const authHeader = generateAuthHeader('POST', urlPath, body);

    const response = await fetch(`${WECHAT_BASE_URL}${urlPath}`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body,
    });

    const result = await response.json();

    if (!response.ok) {
      logger.error('微信转账失败', { status: response.status, result });
      return res.status(response.status).json({
        success: false,
        code: result.code || 'WECHAT_ERROR',
        message: result.message || '微信转账失败',
      });
    }

    logger.info('微信转账成功', { outBatchNo, openid, amount });

    res.json({
      success: true,
      data: {
        outBatchNo,
        outDetailNo,
        batchId: result.batch_id,
        createTime: result.create_time,
        amount: amount.toFixed(2),
        status: 'ACCEPTED',
      },
      message: '转账申请已受理',
    });
  } catch (error) {
    logger.error('微信转账异常', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      code: 'WECHAT_ERROR',
      message: error.message || '微信转账异常',
    });
  }
});

/**
 * 微信批量转账
 */
router.post('/batch-transfer', async (req, res) => {
  try {
    checkConfig();
    const { transfers, batchName, batchRemark } = req.body;

    if (!Array.isArray(transfers) || transfers.length === 0) {
      return res.status(400).json({ success: false, message: '转账列表不能为空' });
    }
    if (transfers.length > 200) {
      return res.status(400).json({ success: false, message: '单次批量转账不能超过200笔' });
    }

    const outBatchNo = `BATCH${Date.now()}${Math.floor(Math.random() * 1000)}`;
    let totalAmount = 0;
    const detailList = transfers.map((item, index) => {
      const amountFen = Math.round(Number(item.amount) * 100);
      totalAmount += amountFen;
      return {
        out_detail_no: `${outBatchNo}${String(index).padStart(4, '0')}`,
        transfer_amount: amountFen,
        transfer_remark: item.remark || '工资发放',
        openid: item.openid,
        user_name: item.userName || undefined,
      };
    });

    const body = JSON.stringify({
      out_batch_no: outBatchNo,
      batch_name: batchName || '全球工资批量发放',
      batch_remark: batchRemark || '全民基本收入',
      total_amount: totalAmount,
      total_num: transfers.length,
      transfer_detail_list: detailList,
    });

    const urlPath = '/v3/transfer/batches';
    const authHeader = generateAuthHeader('POST', urlPath, body);

    const response = await fetch(`${WECHAT_BASE_URL}${urlPath}`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body,
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        code: result.code,
        message: result.message,
      });
    }

    res.json({
      success: true,
      data: {
        outBatchNo,
        batchId: result.batch_id,
        createTime: result.create_time,
        totalAmount: (totalAmount / 100).toFixed(2),
        totalNum: transfers.length,
        status: 'ACCEPTED',
      },
      message: `批量转账申请已受理，共${transfers.length}笔`,
    });
  } catch (error) {
    logger.error('微信批量转账异常', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 查询转账批次
 */
router.get('/batch/:outBatchNo', async (req, res) => {
  try {
    checkConfig();
    const { outBatchNo } = req.params;
    const urlPath = `/v3/transfer/batches/out-batch-no/${outBatchNo}?need_query_detail=true&offset=0&limit=20`;
    const authHeader = generateAuthHeader('GET', urlPath, '');

    const response = await fetch(`${WECHAT_BASE_URL}${urlPath}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    const result = await response.json();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('微信查询失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 微信支付回调通知
 */
router.post('/notify', (req, res) => {
  try {
    const rawBody = JSON.stringify(req.body);
    if (!verifyWechatSignature(req.headers, rawBody)) {
      return res.status(401).json({ code: 'FAIL', message: '签名验证失败' });
    }

    const { resource } = req.body;
    const decrypted = decryptResource(resource.ciphertext, resource.associated_data, resource.nonce);

    logger.info('微信转账回调', {
      outBatchNo: decrypted.out_batch_no,
      batchId: decrypted.batch_id,
      batchStatus: decrypted.batch_status,
      successNum: decrypted.success_num,
      failNum: decrypted.fail_num,
    });

    // 这里可以更新数据库中的转账状态
    // await TransferModel.updateStatus(decrypted.out_batch_no, decrypted.batch_status);

    res.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    logger.error('微信回调处理失败', { error: error.message });
    res.status(500).json({ code: 'FAIL', message: '处理失败' });
  }
});

module.exports = router;
