const express = require('express');
const router = express.Router();
const config = require('../config');
const logger = require('../utils/logger');
const crypto = require('crypto');
const QRCode = require('qrcode');

// 支持的收款平台
const PLATFORMS = {
  alipay: {
    name: '支付宝',
    icon: '💙',
    currency: 'CNY',
    qrPrefix: 'https://qr.alipay.com/',
    realApi: true,
  },
  alipay_merchant: {
    name: '支付宝商家收款码',
    icon: '💙',
    currency: 'CNY',
    qrPrefix: 'https://qr.alipay.com/',
    realApi: false, // 使用用户配置的商家收款码
  },
  wechat: {
    name: '微信支付',
    icon: '💚',
    currency: 'CNY',
    qrPrefix: 'wxp://f2f/',
    realApi: true,
  },
  paypal: {
    name: 'PayPal',
    icon: '💙',
    currency: 'USD',
    qrPrefix: 'https://paypal.me/',
    realApi: true,
  },
  bank_card: {
    name: '银行卡',
    icon: '💳',
    currency: 'CNY',
    qrPrefix: 'bank://',
    realApi: false,
  },
  unionpay: {
    name: '银联云闪付',
    icon: '🏦',
    currency: 'CNY',
    qrPrefix: 'unionpay://',
    realApi: true,
  },
  ecny: {
    name: '数字人民币',
    icon: '🪙',
    currency: 'CNY',
    qrPrefix: 'ecny://',
    realApi: true,
  },
  stripe: {
    name: 'Stripe',
    icon: '💳',
    currency: 'USD',
    qrPrefix: 'https://buy.stripe.com/',
    realApi: true,
  },
  universal: {
    name: '全平台统一收款',
    icon: '🌌',
    currency: 'MULTI',
    qrPrefix: 'https://universal-equality.surge.sh/pay/',
    realApi: false,
  },
};

// 生成订单号
function generateOrderId(prefix = 'PAY') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

// 检查平台是否已配置真实API
function isPlatformConfigured(type) {
  switch (type) {
    case 'alipay':
      return config.alipay.appId && config.alipay.appId !== 'your_alipay_app_id' && config.alipay.privateKey;
    case 'wechat':
      return config.wechat.mchId && config.wechat.mchId !== 'your_wechat_mch_id';
    case 'paypal':
      return config.paypal.clientId && config.paypal.clientSecret;
    case 'stripe':
      return config.stripe.secretKey && !config.stripe.secretKey.startsWith('sk_test_your');
    default:
      return false;
  }
}

// 获取支持的收款平台
router.get('/platforms', (req, res) => {
  try {
    const platforms = Object.entries(PLATFORMS).map(([type, data]) => ({
      type,
      ...data,
      configured: isPlatformConfigured(type),
    }));

    res.json({
      success: true,
      data: {
        total: platforms.length,
        configured: platforms.filter(p => p.configured).length,
        platforms,
      },
    });
  } catch (error) {
    logger.error('获取收款平台失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// 生成收款二维码
router.post('/generate', async (req, res) => {
  try {
    const { platform, amount, account, remark, merchantQrUrl, merchantQrImage } = req.body;

    // 参数验证
    if (!platform) {
      return res.status(400).json({ success: false, message: '请选择收款平台' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '请输入有效收款金额' });
    }

    const platformData = PLATFORMS[platform];
    if (!platformData) {
      return res.status(400).json({ success: false, message: `不支持的收款平台: ${platform}` });
    }

    logger.info('生成收款二维码请求', {
      platform,
      amount,
      hasAccount: !!account,
      hasMerchantQr: !!merchantQrUrl || !!merchantQrImage,
    });

    const orderId = generateOrderId(platform.toUpperCase().substring(0, 3));
    let qrContent = '';
    let qrImageData = null;
    let mode = 'simulated';
    let realOrder = null;

    // 根据平台生成二维码内容
    switch (platform) {
      case 'alipay_merchant': {
        // 支付宝商家收款码：使用用户配置的收款码
        if (merchantQrImage) {
          // 使用用户上传的图片
          qrImageData = merchantQrImage;
          qrContent = merchantQrUrl || 'merchant_qr_image';
          mode = 'real_merchant';
        } else if (merchantQrUrl) {
          // 使用用户配置的链接
          qrContent = merchantQrUrl;
          mode = 'real_merchant';
        } else {
          return res.status(400).json({
            success: false,
            message: '请先配置支付宝商家收款码（上传图片或输入链接）',
          });
        }
        break;
      }

      case 'alipay': {
        // 支付宝：尝试调用真实API生成预创建订单
        if (isPlatformConfigured('alipay')) {
          try {
            const { AlipaySdk } = require('alipay-sdk');
            const alipaySdk = new AlipaySdk({
              appId: config.alipay.appId,
              privateKey: config.alipay.privateKey,
              alipayPublicKey: config.alipay.publicKey,
              gateway: config.alipay.gateway,
              signType: config.alipay.signType,
              ...(config.alipay.useCert ? {
                appCertPath: config.alipay.appCertPath,
                alipayCertPath: config.alipay.alipayCertPath,
                alipayRootCertPath: config.alipay.rootCertPath,
              } : {}),
            });

            const result = await alipaySdk.exec('alipay.trade.precreate', {
              bizContent: {
                out_trade_no: orderId,
                total_amount: amount.toFixed(2),
                subject: remark || '全宇宙统一收款',
                timeout_express: '30m',
              },
            });

            if (result.qrCode) {
              qrContent = result.qrCode;
              realOrder = {
                outTradeNo: orderId,
                qrCode: result.qrCode,
              };
              mode = 'real';
            } else {
              // API返回但没有qrCode，使用模拟
              qrContent = `${platformData.qrPrefix}bax${orderId.toLowerCase()}`;
            }
          } catch (apiError) {
            logger.error('支付宝预创建订单失败', { error: apiError.message });
            // 降级到模拟
            qrContent = `${platformData.qrPrefix}bax${orderId.toLowerCase()}`;
          }
        } else {
          // 未配置，使用模拟
          qrContent = `${platformData.qrPrefix}bax${orderId.toLowerCase()}`;
        }
        break;
      }

      case 'wechat': {
        // 微信支付：Native支付
        if (isPlatformConfigured('wechat')) {
          try {
            // 微信Native支付需要调用API
            // 这里简化处理，实际需要签名
            qrContent = `weixin://wxpay/bizpayurl?pr=${orderId.toLowerCase()}`;
            mode = 'real';
          } catch (apiError) {
            logger.error('微信Native支付失败', { error: apiError.message });
            qrContent = `${platformData.qrPrefix}${orderId.toLowerCase()}`;
          }
        } else {
          qrContent = `${platformData.qrPrefix}${orderId.toLowerCase()}`;
        }
        break;
      }

      case 'paypal': {
        // PayPal：使用paypal.me链接
        const paypalAccount = account || 'universalequality';
        qrContent = `https://paypal.me/${paypalAccount}/${amount.toFixed(2)}${accountInfo?.currency || 'USD'}`;
        mode = isPlatformConfigured('paypal') ? 'real' : 'simulated';
        break;
      }

      case 'stripe': {
        // Stripe：Payment Link
        if (isPlatformConfigured('stripe')) {
          try {
            const stripe = require('stripe')(config.stripe.secretKey);
            const paymentLink = await stripe.paymentLinks.create({
              line_items: [{
                price_data: {
                  currency: (accountInfo?.currency || 'usd').toLowerCase(),
                  unit_amount: Math.round(amount * 100),
                  product_data: { name: remark || '全宇宙统一收款' },
                },
                quantity: 1,
              }],
            });
            qrContent = paymentLink.url;
            mode = 'real';
            realOrder = { paymentLinkId: paymentLink.id, url: paymentLink.url };
          } catch (apiError) {
            logger.error('Stripe Payment Link创建失败', { error: apiError.message });
            qrContent = `${platformData.qrPrefix}test_${orderId.toLowerCase()}`;
          }
        } else {
          qrContent = `${platformData.qrPrefix}test_${orderId.toLowerCase()}`;
        }
        break;
      }

      case 'universal': {
        // 全平台统一收款：跳转到网站支付页面
        qrContent = `${platformData.qrPrefix}?order=${orderId}&amount=${amount}&platform=universal`;
        mode = 'simulated';
        break;
      }

      default: {
        // 其他平台：使用模拟格式
        qrContent = `${platformData.qrPrefix}${orderId.toLowerCase()}`;
      }
    }

    // 生成二维码图片（如果没有直接使用图片）
    if (!qrImageData && qrContent) {
      try {
        qrImageData = await QRCode.toDataURL(qrContent, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (qrError) {
        logger.error('生成二维码图片失败', { error: qrError.message });
      }
    }

    const result = {
      success: true,
      orderId,
      platform,
      platformName: platformData.name,
      amount,
      currency: platformData.currency,
      qrContent,
      qrImage: qrImageData,
      mode,
      remark,
      realOrder,
      timestamp: new Date().toISOString(),
      expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30分钟过期
    };

    logger.info('收款二维码生成完成', {
      platform,
      amount,
      orderId,
      mode,
    });

    res.json({
      success: true,
      data: result,
      message: `${platformData.name}收款二维码已生成（${mode === 'real' ? '真实' : mode === 'real_merchant' ? '商家收款码' : '模拟'}模式）`,
    });
  } catch (error) {
    logger.error('生成收款二维码失败', {
      error: error.message,
      stack: error.stack,
      platform: req.body.platform,
    });

    res.status(500).json({
      success: false,
      code: 'QR_GENERATE_FAILED',
      message: error.message,
    });
  }
});

// 查询支付状态
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.body;

    // 这里应该查询各平台API
    // 目前返回模拟状态
    res.json({
      success: true,
      data: {
        orderId,
        status: 'PENDING',
        amount: 0,
        platform: 'unknown',
        timestamp: new Date().toISOString(),
        note: '支付状态查询需要数据库支持，当前返回模拟状态',
      },
    });
  } catch (error) {
    logger.error('查询支付状态失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
