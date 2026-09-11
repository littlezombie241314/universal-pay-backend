const config = require('../config');
const logger = require('./logger');

// API Key 鉴权中间件
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey || apiKey !== config.apiKey) {
    logger.warn('API Key 鉴权失败', { ip: req.ip, path: req.path });
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: '无效的API密钥',
    });
  }
  next();
}

// 请求限流中间件（简单版）
const requestCounts = new Map();
function rateLimit(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, { count: 0, firstRequest: now });
    }
    const record = requestCounts.get(ip);
    if (now - record.firstRequest > windowMs) {
      record.count = 0;
      record.firstRequest = now;
    }
    record.count++;
    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: '请求过于频繁，请稍后再试',
      });
    }
    next();
  };
}

module.exports = { apiKeyAuth, rateLimit };
