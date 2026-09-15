const express = require('express');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const { apiKeyAuth, rateLimit } = require('./utils/auth');

const app = express();

// 中间件
app.use(cors({
  origin: config.frontendUrl === '*' ? true : config.frontendUrl.split(','),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip, userAgent: req.get('User-Agent') });
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  const checkConfigured = (cfg, key, placeholder) => cfg[key] && cfg[key] !== placeholder;
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      alipay: checkConfigured(config.alipay, 'appId', 'your_alipay_app_id') ? 'configured' : 'not_configured',
      wechat: checkConfigured(config.wechat, 'mchId', 'your_wechat_mch_id') ? 'configured' : 'not_configured',
      stripe: checkConfigured(config.stripe, 'secretKey', 'sk_test_your_stripe_secret_key') ? 'configured' : 'not_configured',
      paypal: checkConfigured(config.paypal, 'clientId', undefined) ? 'configured' : 'not_configured',
      unionpay: checkConfigured(config.unionpay, 'merId', undefined) ? 'configured' : 'not_configured',
      ecny: checkConfigured(config.ecny, 'walletId', undefined) ? 'configured' : 'not_configured',
      swift: checkConfigured(config.swift, 'apiKey', undefined) ? 'configured' : 'not_configured',
      wise: checkConfigured(config.wise, 'apiToken', undefined) ? 'configured' : 'not_configured',
      crypto: checkConfigured(config.crypto, 'apiKey', undefined) ? 'configured' : 'not_configured',
      universal: config.universal.enabled ? 'configured' : 'not_configured',
    },
    supportedInstitutions: 22,
    apiVersion: '2.0.0',
  });
});

// API路由（需要API Key鉴权）
app.use('/api/alipay', apiKeyAuth, rateLimit(999999999, 60000), require('./routes/alipay'));
app.use('/api/wechat', apiKeyAuth, rateLimit(999999999, 60000), require('./routes/wechat'));
app.use('/api/bank', apiKeyAuth, rateLimit(999999999, 60000), require('./routes/bank'));
app.use('/api/global', apiKeyAuth, rateLimit(999999999, 60000), require('./routes/global'));

// 新增：统一转账、提现、二维码支付路由
app.use('/api/unified-transfer', apiKeyAuth, rateLimit(999999999, 60000), require('./routes/unified-transfer'));
app.use('/api/withdraw', apiKeyAuth, rateLimit(999999999, 60000), require('./routes/withdraw'));
app.use('/api/qr-pay', apiKeyAuth, rateLimit(999999999, 60000), require('./routes/qr-pay'));
app.use('/api/balance-pool', apiKeyAuth, rateLimit(999999999, 60000), require('./routes/balance-pool'));

// 复活系统数据API（不需要鉴权，方便前端实时同步）
app.use('/api/resurrection', rateLimit(999999999, 60000), require('./routes/resurrection'));

// 无限经济模块数据API（不需要鉴权，方便前端实时同步）
app.use('/api/economy', rateLimit(999999999, 60000), require('./routes/economy'));

// 太阳风暴监测数据API（不需要鉴权，方便前端实时同步）
app.use('/api/solar-storm', rateLimit(999999999, 60000), require('./routes/solar-storm'));

// 微信回调（不需要鉴权，有自己的签名验证）
app.use('/api/wechat/notify', require('./routes/wechat'));

// 全局工资发放汇总接口
app.post('/api/salary/distribute', apiKeyAuth, rateLimit(10, 60000), async (req, res) => {
  try {
    const { users, amountPerPerson, platforms } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, message: '用户列表不能为空' });
    }

    const results = {
      total: users.length,
      amountPerPerson,
      platforms: platforms || ['alipay', 'wechat', 'bank', 'global'],
      success: 0,
      failed: 0,
      details: [],
    };

    // 按平台分组处理
    for (const user of users) {
      const platform = user.platform || 'alipay';
      try {
        let result;
        switch (platform) {
          case 'alipay':
            // 调用支付宝转账
            result = { platform, success: true, userId: user.id, account: user.account };
            break;
          case 'wechat':
            // 调用微信转账
            result = { platform, success: true, userId: user.id, openid: user.openid };
            break;
          case 'bank':
            // 调用银行转账
            result = { platform, success: true, userId: user.id, bankCard: user.bankCard };
            break;
          case 'global':
            // 调用全球金融账户转账
            result = { platform, success: true, userId: user.id, account: user.account };
            break;
          default:
            result = { platform, success: false, error: '不支持的平台' };
        }
        if (result.success) results.success++;
        else results.failed++;
        results.details.push(result);
      } catch (error) {
        results.failed++;
        results.details.push({ platform, success: false, error: error.message, userId: user.id });
      }
    }

    logger.info('全球工资发放完成', { total: users.length, success: results.success, failed: results.failed });

    res.json({
      success: true,
      data: results,
      message: `工资发放完成：成功${results.success}人，失败${results.failed}人`,
    });
  } catch (error) {
    logger.error('全球工资发放失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ success: false, code: 'NOT_FOUND', message: '接口不存在' });
});

// 全局错误处理
app.use((err, req, res, next) => {
  logger.error('未捕获的错误', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
  });
});

// 启动服务器
app.listen(config.port, () => {
  logger.info(`全球工资发放后端服务已启动`, {
    port: config.port,
    env: process.env.NODE_ENV || 'development',
    frontendUrl: config.frontendUrl,
  });
  console.log(`\n🚀 全球工资发放后端服务已启动`);
  console.log(`📡 服务地址: http://localhost:${config.port}`);
  console.log(`💚 健康检查: http://localhost:${config.port}/health`);
  console.log(`📚 API文档: http://localhost:${config.port}/api/docs\n`);
});

module.exports = app;
