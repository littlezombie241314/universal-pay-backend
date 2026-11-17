/**
 * 全宇宙恒等系统 - 真实支付宝转账后端（沙箱/生产双模式）
 * 部署：onrender / vercel / 任意 Node 云主机
 * 环境变量（生产/沙箱二选一，由 ALIPAY_MODE 切换）：
 *   ALIPAY_MODE=sandbox|prod
 *   ALIPAY_APP_ID=        应用APPID（沙箱/生产各自）
 *   ALIPAY_PRIVATE_KEY=   应用私钥（RSA2，PKCS8，换行用 \n）
 *   【公钥模式】ALIPAY_PUBLIC_KEY= 支付宝公钥（沙箱环境取沙箱公钥）
 *   【证书模式】ALIPAY_APP_CERT=应用公钥证书 / ALIPAY_ALIPAY_CERT=支付宝公钥证书 / ALIPAY_ROOT_CERT=根证书
 *   ALIPAY_UID=           收款方支付宝UID（可选，若用固定收款账户）
 *   TRANSFER_AMOUNT_LIMIT=单笔限额（元，默认 100000）
 */
const express = require('express');
const cors = require('cors');
const AlipaySdkModule = require('alipay-sdk');
// 兼容不同版本导出：命名导出 AlipaySdk / default / 直接构造函数
const AlipaySdk = AlipaySdkModule.AlipaySdk || AlipaySdkModule.default || AlipaySdkModule;

const app = express();
app.use(cors());
app.use(express.json());

const fs = require('fs');
const path = require('path');
const cryptoApi = require('./crypto');

// 配置优先级：环境变量 > config.local.json > 默认值（config.local.json 用于 Render 一键部署）
let LOCAL_CFG = {};
try { LOCAL_CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.local.json'), 'utf8')); } catch (e) {}
const MODE = process.env.ALIPAY_MODE || LOCAL_CFG.ALIPAY_MODE || 'sandbox';
const APP_ID = process.env.ALIPAY_APP_ID || LOCAL_CFG.ALIPAY_APP_ID || '';
let PRIVATE_KEY = (process.env.ALIPAY_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const ALIPAY_PUBLIC_KEY = (process.env.ALIPAY_PUBLIC_KEY || '').replace(/\\n/g, '\n');
// 证书优先取环境变量；未配置时尝试从仓库 certs/ 目录读取（证书为公开公钥材料）
const certDir = path.join(__dirname, 'certs');
const readCert = (name) => {
  const fromEnv = process.env['ALIPAY_' + name];
  if (fromEnv) return fromEnv.replace(/\\n/g, '\n');
  try { return fs.readFileSync(path.join(certDir, name.toLowerCase() + '.pem'), 'utf8').trim(); }
  catch (e) { return ''; }
};
const APP_CERT = readCert('APP_CERT');
const ALIPAY_CERT = readCert('ALIPAY_CERT');
const ROOT_CERT = readCert('ROOT_CERT');
// 私钥兜底：环境变量未配置时从仓库 certs/app_private_key.pem 读取（部署零环境变量方案）
if (!PRIVATE_KEY) {
  try { PRIVATE_KEY = fs.readFileSync(path.join(certDir, 'app_private_key.pem'), 'utf8').trim(); }
  catch (e) { PRIVATE_KEY = ''; }
}
const LIMIT = parseFloat(process.env.TRANSFER_AMOUNT_LIMIT || '100000');
const GATEWAY = MODE === 'prod'
  ? 'https://openapi.alipay.com/gateway.do'
  : 'https://openapi.alipaydev.com/gateway.do';

const certMode = !!(APP_CERT && ALIPAY_CERT && ROOT_CERT);

let alipay = null;
if (APP_ID && PRIVATE_KEY && (ALIPAY_PUBLIC_KEY || certMode)) {
  try {
    const sdkCfg = {
      appId: APP_ID,
      keyType: 'PKCS8', // 应用私钥为 PKCS8 格式（-----BEGIN PRIVATE KEY-----），避免 SDK 默认按 PKCS1 重写导致 DECODER 失败
      privateKey: PRIVATE_KEY,
      gateway: GATEWAY,
      signType: 'RSA2',
      timeout: 15000,
    };
    if (certMode) {
      // 证书模式：应用公钥证书 + 支付宝公钥证书 + 根证书
      sdkCfg.appCertContent = APP_CERT;
      sdkCfg.alipayPublicCertContent = ALIPAY_CERT;
      sdkCfg.alipayRootCertContent = ROOT_CERT;
    } else {
      sdkCfg.alipayPublicKey = ALIPAY_PUBLIC_KEY;
    }
    alipay = new AlipaySdk(sdkCfg);
    console.log('[支付宝] SDK 已初始化，模式 =', MODE, '· 加签方式 =', certMode ? '证书' : '公钥');
  } catch (e) {
    console.error('[支付宝] SDK 初始化失败:', e.message);
  }
}

const cfgOk = () => !!(alipay && APP_ID && PRIVATE_KEY && (ALIPAY_PUBLIC_KEY || certMode));

app.get('/api/alipay/status', (req, res) => {
  res.json({
    success: true,
    configured: cfgOk(),
    mode: MODE,
    certMode,
    appId: APP_ID ? APP_ID.slice(0, 8) + '****' : '',
    gateway: GATEWAY,
    limit: LIMIT,
    message: cfgOk() ? '✅ 支付宝真实通道已就绪' : '⚠ 未配置凭证（APPID/私钥 + 公钥或证书三件），请在环境变量中配置',
  });
});

/** 凭证诊断（不泄露完整密钥：仅回显长度/首尾/换行特征，排查部署环境变量格式） */
app.get('/api/alipay/diag', (req, res) => {
  const summarize = (s) => ({
    len: (s || '').length,
    head: (s || '').slice(0, 27),
    tail: (s || '').slice(-12),
    realNewlines: ((s || '').match(/\n/g) || []).length,
  });
  res.json({
    success: true,
    appId: APP_ID,
    certMode,
    privateKey: summarize(PRIVATE_KEY),
    alipayPublicKey: summarize(ALIPAY_PUBLIC_KEY),
    appCert: summarize(APP_CERT),
    alipayCert: summarize(ALIPAY_CERT),
    rootCert: summarize(ROOT_CERT),
    sdkCtorOk: typeof AlipaySdk === 'function',
  });
});

/** 余额查询（alipay.fund.account.query - 查询支付宝账户余额，需签约） */
app.get('/api/alipay/balance', async (req, res) => {
  if (!cfgOk()) return res.json({ success: false, configured: false, message: '支付宝通道未配置' });
  try {
    const r = await alipay.exec('alipay.fund.account.query', {
      bizContent: {
        alipayUserId: req.query.uid || process.env.ALIPAY_UID || '',
        accountProductCode: req.query.productCode || 'STANDARD',
        accountSceneCode: req.query.sceneCode || 'DEFAULT',
      },
    });
    res.json({ success: true, data: r });
  } catch (e) {
    res.json({ success: false, message: e.message || String(e) });
  }
});

/**
 * 真实转账到支付宝账户（alipay.fund.trans.uni.transfer - 单笔转账）
 * 入参：{ payeeAccount: 支付宝账号/手机号, payeeName: 姓名, amount: 金额, remark: 备注 }
 * 注意：需要支付宝开放平台已签约「转账到支付宝账户」产品
 */
app.post('/api/alipay/transfer', async (req, res) => {
  if (!cfgOk()) return res.json({ success: false, configured: false, message: '支付宝通道未配置，请先配置 APPID/私钥/支付宝公钥' });
  const { payeeAccount, payeeName, amount, remark, transferSceneName, infoType, infoContent } = req.body || {};
  if (!payeeAccount) return res.json({ success: false, message: '缺少收款方支付宝账号' });
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.json({ success: false, message: '金额无效' });
  if (amt > LIMIT) return res.json({ success: false, message: '超出单笔限额 ' + LIMIT + ' 元' });

  const outBizNo = 'UES' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
  // 支付宝新版 uni transfer 要求：name 为字符串；transfer_scene_name 须为商家中心已创建的转账场景名称；
  // transfer_scene_report_infos 为场景报备信息（info_type 固定值见支付宝文档）。
  const isLogon = /^1\d{10}$/.test(payeeAccount) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payeeAccount);
  const identity = isLogon
    ? { identity_type: 'ALIPAY_LOGON_ID', identity: payeeAccount, name: payeeName || '' }
    : { identity_type: 'ALIPAY_USER_ID', identity: payeeAccount, name: payeeName || '' };

  try {
    const r = await alipay.exec('alipay.fund.trans.uni.transfer', {
      bizContent: {
        out_biz_no: outBizNo,
        trans_amount: amt.toFixed(2),
        product_code: 'TRANS_ACCOUNT_NO_PWD',
        biz_scene: 'DIRECT_TRANSFER',
        transfer_scene_name: transferSceneName || '佣金报酬',
        transfer_scene_report_infos: [
          { info_type: infoType || '佣金报酬说明', info_content: infoContent || remark || '全宇宙恒等系统·真实转账' },
        ],
        payee_info: identity,
      },
    });
    // 支付宝网关业务码：10000=成功；必须显式校验，否则业务失败会被误报为到账成功
    const code = r && (r.code || r.errorCode);
    if (code && code !== '10000') {
      return res.json({
        success: false,
        code,
        subCode: (r && (r.subCode || r.sub_code)) || '',
        message: (r && (r.subMsg || r.sub_msg || r.msg)) || '支付宝网关拒绝该请求',
        outBizNo,
      });
    }
    res.json({
      success: true,
      data: {
        orderId: outBizNo,
        outBizNo,
        status: 'SUCCESS',
        tradeNo: (r && (r.tradeNo || r.trade_no)) || '',
        payDate: (r && (r.payDate || r.pay_date)) || '',
        mode: 'real',
        channel: '支付宝官方·单笔转账',
        payeeAccount,
        amount: amt,
        remark: remark || '',
      },
    });
  } catch (e) {
    res.json({
      success: false,
      code: (e && (e.code || e.subCode)) || '',
      subCode: (e && e.subCode) || '',
      message: (e && (e.message || e.subMsg || e.rawErrorMessage)) || String(e),
      outBizNo,
    });
  }
});

/** 转账结果查询（alipay.fund.trans.common.query） */
app.get('/api/alipay/transfer/query', async (req, res) => {
  if (!cfgOk()) return res.json({ success: false, configured: false, message: '支付宝通道未配置' });
  const outBizNo = req.query.outBizNo;
  if (!outBizNo) return res.json({ success: false, message: '缺少 outBizNo' });
  try {
    const r = await alipay.exec('alipay.fund.trans.common.query', {
      bizContent: { out_biz_no: outBizNo, product_code: 'TRANS_ACCOUNT_NO_PWD', biz_scene: 'DIRECT_TRANSFER' },
    });
    res.json({ success: true, data: r });
  } catch (e) {
    res.json({ success: false, message: e.message || String(e) });
  }
});

/* ================= 真实转账到银行卡（uni.transfer TRANS_BANKCARD_NO_PWD） ================= */
const BANK_CODE_MAP = {
  '中国工商银行': 'ICBC', '中国农业银行': 'ABC', '中国银行': 'BOC', '中国建设银行': 'CCB',
  '招商银行': 'CMB', '交通银行': 'COMM', '中国邮政储蓄银行': 'PSBC', '兴业银行': 'CIB',
  '浦发银行': 'SPDB', '广发银行': 'GDB', '中信银行': 'CITIC', '光大银行': 'CEB',
  '平安银行': 'PAB', '民生银行': 'CMBC', '华夏银行': 'HXB',
};

/** 单笔转账到银行卡核心逻辑（channel 用于标识提现/转账） */
async function doBankTransfer(req, res, channel) {
  const { payeeBankAccount, payeeBankName, payeeName, amount, remark, bankCode, transferSceneName, infoType, infoContent } = req.body || {};
  if (!payeeBankAccount) return res.json({ success: false, message: '缺少收款银行卡号' });
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.json({ success: false, message: '金额无效' });
  if (amt > LIMIT) return res.json({ success: false, message: '超出单笔限额 ' + LIMIT + ' 元' });
  const outBizNo = 'UEB' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
  try {
    const r = await alipay.exec('alipay.fund.trans.uni.transfer', {
      bizContent: {
        out_biz_no: outBizNo,
        trans_amount: amt.toFixed(2),
        product_code: 'TRANS_BANKCARD_NO_PWD',
        biz_scene: 'DIRECT_TRANSFER',
        // 转账到银行卡（TRANS_BANKCARD_NO_PWD）不适用商家转账场景报备参数
        payee_info: {
          // 转账到银行卡：identity_type 官方值为 BANK_CARD；需应用添加「单笔转账到银行卡」功能包（联系支付宝业务人员）后方可调用
          identity_type: 'BANK_CARD',
          identity: String(payeeBankAccount),
          name: payeeName || '',
          bankcard_ext_info: { bank_code: bankCode || BANK_CODE_MAP[payeeBankName] || '', inst_name: payeeBankName || '', account_type: '2' },
        },
      },
    });
    const code = r && (r.code || r.errorCode);
    if (code && code !== '10000') {
      return res.json({ success: false, code, subCode: (r && (r.subCode || r.sub_code)) || '', message: (r && (r.subMsg || r.sub_msg || r.msg)) || '支付宝网关拒绝该请求', outBizNo });
    }
    res.json({ success: true, data: { orderId: outBizNo, outBizNo, status: 'SUCCESS', tradeNo: (r && (r.tradeNo || r.trade_no)) || '', payDate: (r && (r.payDate || r.pay_date)) || '', mode: 'real', channel, payeeBankAccount, amount: amt, remark: remark || '' } });
  } catch (e) {
    res.json({ success: false, message: (e && (e.message || e.rawErrorMessage || e.subMsg)) || String(e), outBizNo });
  }
}

/** 真实转账到银行卡（单笔转账到银行卡）
 * 入参：{ payeeBankAccount: 银行卡号, payeeBankName: 银行名称(如"中国银行"), payeeName: 收款人姓名, amount, remark, bankCode? }
 * 注意：需签约「单笔转账到银行卡」功能包；付款方余额支付需可用
 */
app.post('/api/alipay/transfer/bank', async (req, res) => {
  if (!cfgOk()) return res.json({ success: false, configured: false, message: '支付宝通道未配置，请先配置 APPID/私钥/支付宝公钥' });
  await doBankTransfer(req, res, '支付宝官方·转账到银行卡');
});

/** 提现到绑定银行卡（映射单笔转账到银行卡，收款卡为本人绑定卡）
 * 入参：{ payeeBankAccount: 本人银行卡号, payeeBankName: 开户银行, payeeName: 账户名, amount, remark }
 */
app.post('/api/alipay/withdraw', async (req, res) => {
  if (!cfgOk()) return res.json({ success: false, configured: false, message: '支付宝通道未配置，请先配置 APPID/私钥/支付宝公钥' });
  await doBankTransfer(req, res, '支付宝官方·提现到银行卡');
});

/* ================= 批量转账到支付宝账户（商家转账批量能力，串行逐笔） ================= */
/** 入参：{ transfers: [{payeeAccount, payeeName, amount, remark}...], transferSceneName?, infoType?, infoContent? } 单批最多500笔 */
app.post('/api/alipay/transfer/batch', async (req, res) => {
  if (!cfgOk()) return res.json({ success: false, configured: false, message: '支付宝通道未配置，请先配置 APPID/私钥/支付宝公钥' });
  const { transfers, transferSceneName, infoType, infoContent } = req.body || {};
  if (!Array.isArray(transfers) || transfers.length === 0) return res.json({ success: false, message: '缺少转账明细列表 transfers' });
  if (transfers.length > 500) return res.json({ success: false, message: '单批最多500笔' });
  const results = [];
  let okCount = 0;
  for (const t of transfers) {
    const { payeeAccount, payeeName, amount, remark } = t || {};
    if (!payeeAccount || !amount) { results.push({ payeeAccount: payeeAccount || '', amount: amount || '', success: false, message: '明细缺少收款账号或金额' }); continue; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { results.push({ payeeAccount, amount, success: false, message: '金额无效' }); continue; }
    const outBizNo = 'UEB' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
    const isLogon = /^1\d{10}$/.test(payeeAccount) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payeeAccount);
    const identity = isLogon
      ? { identity_type: 'ALIPAY_LOGON_ID', identity: payeeAccount, name: payeeName || '' }
      : { identity_type: 'ALIPAY_USER_ID', identity: payeeAccount, name: payeeName || '' };
    try {
      const r = await alipay.exec('alipay.fund.trans.uni.transfer', {
        bizContent: {
          out_biz_no: outBizNo,
          trans_amount: amt.toFixed(2),
          product_code: 'TRANS_ACCOUNT_NO_PWD',
          biz_scene: 'DIRECT_TRANSFER',
          transfer_scene_name: transferSceneName || '佣金报酬',
          transfer_scene_report_infos: [ { info_type: infoType || '佣金报酬说明', info_content: infoContent || remark || '全宇宙恒等系统·真实转账' } ],
          payee_info: identity,
        },
      });
      const code = r && (r.code || r.errorCode);
      if (code && code !== '10000') { results.push({ payeeAccount, payeeName, amount: amt, success: false, code, message: (r && (r.subMsg || r.sub_msg || r.msg)) || '支付宝网关拒绝该请求' }); continue; }
      okCount++;
      results.push({ payeeAccount, payeeName, amount: amt, success: true, outBizNo, tradeNo: (r && (r.tradeNo || r.trade_no)) || '' });
    } catch (e) {
      results.push({ payeeAccount, payeeName, amount: amt, success: false, message: (e && (e.message || e.rawErrorMessage || e.subMsg)) || String(e) });
    }
  }
  res.json({ success: okCount > 0, total: transfers.length, successCount: okCount, results });
});

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', mode: MODE, ts: Date.now() }));

/* ================= 全宇宙恒等系统模块状态（前端心跳） ================= */
app.get('/api/economy/state', (req, res) => res.json({
  success: true,
  module: 'economy',
  balance: '∞',
  wallet: 'unlimited',
  channels: ['ues-self-ledger', 'alipay-bridge'],
  ts: Date.now()
}));

app.get('/api/solar-storm/state', (req, res) => res.json({
  success: true,
  module: 'solar-storm',
  status: 'monitoring',
  level: 'green',
  lastEvent: null,
  ts: Date.now()
}));

app.get('/api/resurrection/state', (req, res) => res.json({
  success: true,
  module: 'resurrection',
  totalResurrected: 28913094550629,
  status: 'online',
  ts: Date.now()
}));

/* ================= 加密货币真实转账（TRON TRC20 + Ethereum ERC20） ================= */
app.get('/api/crypto/status', async (req, res) => {
  try {
    const b = await cryptoApi.getBalances();
    res.json({ success: true, configured: !!b.configured, ...b });
  } catch (e) {
    res.json({ success: false, message: e.message || String(e) });
  }
});

app.post('/api/crypto/transfer', async (req, res) => {
  const { chain, to, amount, token } = req.body || {};
  try {
    const r = await cryptoApi.transfer({ chain, to, amount, token });
    res.json(r);
  } catch (e) {
    res.json({ success: false, message: e.message || String(e) });
  }
});

/* ============================================================
 * 💳 全宇宙无限钱包 · 唯一支付接口（/wallet/api/v1/*）
 * 全宇宙所有层级、所有支付场景（收款/付款码/扫码支付/转账/提现/消费）
 * 仅此一个支付接口，统一调用本接口层：
 *   - internal / 全宇宙内部账户 -> 自研结算通道：账本直结，无限制，不经过支付宝
 *   - alipay_personal / alipay_company -> 现实世界桥：真实转账到支付宝账户
 *   - bank -> 现实世界桥：待开通「单笔转账到银行卡」功能包（如实返回，不假装成功）
 * ============================================================ */
const WALLET_VERSION = '1.0';
const WALLET_LEDGER = { orders: [], internal_flow: 0, bridge: { available_amount: 0, freeze_amount: 0 } };

function walletNewNo(prefix) {
  return (prefix || 'UEI') + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function walletOrder(o) {
  const order = Object.assign({
    outBizNo: o.outBizNo, orderId: o.outBizNo,
    payeeType: o.payeeType || '', payeeAccount: o.payeeAccount || '', payeeName: o.payeeName || '',
    amount: o.amount || 0, remark: o.remark || '', status: o.status || 'PENDING',
    channel: o.channel || '', mode: o.mode || 'ledger', payDate: new Date().toISOString(), ts: Date.now()
  }, o.extra || {});
  WALLET_LEDGER.orders.unshift(order);
  if (WALLET_LEDGER.orders.length > 500) WALLET_LEDGER.orders.length = 500;
  return order;
}

function walletOk(data) { return { success: true, code: '0', msg: 'ok', data: data || {} }; }
function walletFail(msg, code) { return { success: false, code: code || 'ERROR', msg: msg }; }

// 现实世界桥 · 真实单笔转账到支付宝账户（与 /api/alipay/transfer 同一链路）
async function execAlipayTransfer({ payeeAccount, payeeName, amount, remark, transferSceneName, infoType, infoContent, prefix }) {
  if (!cfgOk()) return { success: false, code: 'NOT_CONFIGURED', message: '支付宝现实世界桥未配置（APPID/私钥/证书）' };
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return { success: false, message: '金额无效' };
  if (amt > LIMIT) return { success: false, message: '超出单笔限额 ' + LIMIT + ' 元' };
  const outBizNo = (prefix || 'UEW') + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
  const isLogon = /^1\d{10}$/.test(payeeAccount) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payeeAccount);
  const identity = isLogon
    ? { identity_type: 'ALIPAY_LOGON_ID', identity: payeeAccount, name: payeeName || '' }
    : { identity_type: 'ALIPAY_USER_ID', identity: payeeAccount, name: payeeName || '' };
  try {
    const r = await alipay.exec('alipay.fund.trans.uni.transfer', {
      bizContent: {
        out_biz_no: outBizNo,
        trans_amount: amt.toFixed(2),
        product_code: 'TRANS_ACCOUNT_NO_PWD',
        biz_scene: 'DIRECT_TRANSFER',
        transfer_scene_name: transferSceneName || '佣金报酬',
        transfer_scene_report_infos: [
          { info_type: infoType || '佣金报酬说明', info_content: infoContent || remark || '全宇宙恒等系统·真实转账' },
        ],
        payee_info: identity,
      },
    });
    const code = r && (r.code || r.errorCode);
    if (code && code !== '10000') {
      return { success: false, code, subCode: (r && (r.subCode || r.sub_code)) || '', message: (r && (r.subMsg || r.sub_msg || r.msg)) || '支付宝网关拒绝该请求', outBizNo };
    }
    return { success: true, data: { orderId: outBizNo, outBizNo, status: 'SUCCESS', tradeNo: (r && (r.tradeNo || r.trade_no)) || '', payDate: (r && (r.payDate || r.pay_date)) || '', mode: 'real', channel: '支付宝官方·现实世界桥', payeeAccount, amount: amt, remark: remark || '' } };
  } catch (e) {
    return { success: false, code: (e && (e.code || e.subCode)) || '', message: (e && (e.message || e.subMsg || e.rawErrorMessage)) || String(e), outBizNo };
  }
}

// 1) 钱包网关状态
app.post('/wallet/api/v1/status', (req, res) => {
  const b = WALLET_LEDGER.bridge;
  res.json(walletOk({
    apiVersion: WALLET_VERSION,
    gateway: 'self-ledger',
    settlement: '自研结算通道·账本直结',
    unlimited: true,
    channels: {
      self_ledger: { status: 'enabled', desc: '内部支付 · 账本直结 · 不经过支付宝' },
      alipay_bridge: { status: cfgOk() ? 'enabled' : 'pending', desc: '现实世界桥 · 真实转账到支付宝' },
      bank_withdraw: { status: 'pending', desc: '提现到银行卡 · 待开通功能包' }
    },
    balance: { internal_flow: WALLET_LEDGER.internal_flow, bridge: { available_amount: b.available_amount, freeze_amount: b.freeze_amount } }
  }));
});

// 2) 钱包余额
app.post('/wallet/api/v1/balance', (req, res) => {
  const b = WALLET_LEDGER.bridge;
  res.json(walletOk({
    internal_total: '∞',
    internal_flow: WALLET_LEDGER.internal_flow,
    settlement: '自研结算通道·账本直结',
    unlimited: true,
    bridge: { available_amount: b.available_amount, freeze_amount: b.freeze_amount }
  }));
});

// 3) 全宇宙转账（唯一支付接口核心）
app.post('/wallet/api/v1/transfer', async (req, res) => {
  const { payeeType, payeeAccount, payeeName, amount, remark, transferSceneName, infoType, infoContent } = req.body || {};
  const amt = parseFloat(amount);
  if (!payeeAccount) return res.json(walletFail('缺少收款账户', 'INVALID_PARAMETER'));
  if (!amt || amt <= 0) return res.json(walletFail('金额无效', 'INVALID_PARAMETER'));
  const type = String(payeeType || '').toLowerCase();
  // 自研结算通道：内部账户账本直结（无限制）
  if (type === 'internal' || type === 'ues' || payeeType === '全宇宙系统内部账户') {
    const order = walletOrder({ outBizNo: walletNewNo('UEI'), payeeType: 'internal', payeeAccount, payeeName, amount: amt, remark, status: 'SUCCESS', channel: '自研结算通道·账本直结', mode: 'ledger' });
    WALLET_LEDGER.internal_flow += amt;
    return res.json(walletOk(order));
  }
  // 现实世界桥：真实转账到支付宝账户
  if (type === 'alipay_personal' || type === 'alipay_company' || type === 'alipay') {
    const r = await execAlipayTransfer({ payeeAccount, payeeName, amount: amt, remark, transferSceneName, infoType, infoContent, prefix: 'UEW' });
    if (r.success) {
      const d = r.data;
      walletOrder({ outBizNo: d.outBizNo, payeeType: 'alipay', payeeAccount, payeeName, amount: amt, remark, status: 'SUCCESS', channel: '支付宝官方·现实世界桥', mode: 'real', extra: { tradeNo: d.tradeNo } });
      return res.json(walletOk(d));
    }
    return res.json({ success: false, code: r.code || 'ALIPAY_ERROR', subCode: r.subCode || '', msg: r.message, outBizNo: r.outBizNo || '' });
  }
  // 银行卡：如实返回未开通（不假装成功）
  if (type === 'bank') {
    return res.json({ success: false, code: 'CHANNEL_NOT_OPEN', msg: '银行卡渠道待开通：需先开通「单笔转账到银行卡」功能包（当前调用会返回 identity_type 取值不合法）' });
  }
  // 其他渠道：如实返回未开通
  return res.json({ success: false, code: 'CHANNEL_NOT_OPEN', msg: '渠道未开通：全宇宙唯一支付接口仅支持 内部账户（账本直结）/ 支付宝现实世界桥 / 银行卡（待开通）' });
});

// 4) 转账单据核验
app.post('/wallet/api/v1/transfer/query', async (req, res) => {
  const outBizNo = (req.body && req.body.outBizNo) || '';
  if (!outBizNo) return res.json(walletFail('缺少交易单号 outBizNo', 'INVALID_PARAMETER'));
  const found = WALLET_LEDGER.orders.find(o => o.outBizNo === outBizNo);
  if (found) {
    return res.json(walletOk({ outBizNo: found.outBizNo, status: found.status, orderId: found.orderId, payDate: found.payDate, transAmount: found.amount, gateway: found.channel }));
  }
  if (cfgOk() && (outBizNo.indexOf('UEW') === 0 || outBizNo.indexOf('UES') === 0)) {
    try {
      const r = await alipay.exec('alipay.fund.trans.common.query', {
        bizContent: { out_biz_no: outBizNo, product_code: 'TRANS_ACCOUNT_NO_PWD', biz_scene: 'DIRECT_TRANSFER' },
      });
      return res.json(walletOk({ outBizNo, status: (r && (r.status || r.order_status)) || 'UNKNOWN', orderId: outBizNo, transAmount: (r && (r.amount || r.trans_amount)) || '', gateway: '支付宝官方·现实世界桥' }));
    } catch (e) {
      return res.json(walletFail('查询失败：' + (e.message || e), 'QUERY_FAILED'));
    }
  }
  return res.json(walletFail('未找到该交易单号', 'ORDER_NOT_FOUND'));
});

// 5) 批量代发（逐笔：internal 账本直结 / alipay 真实转账）
app.post('/wallet/api/v1/transfer/batch', async (req, res) => {
  const transfers = (req.body && req.body.transfers) || [];
  if (!Array.isArray(transfers) || transfers.length === 0) return res.json(walletFail('缺少转账明细列表 transfers', 'INVALID_PARAMETER'));
  if (transfers.length > 500) return res.json(walletFail('单批最多500笔', 'INVALID_PARAMETER'));
  const results = [];
  let okCount = 0;
  for (const t of transfers) {
    const { payeeType, payeeAccount, payeeName, amount, remark } = t || {};
    if (!payeeAccount || !amount) { results.push({ payeeAccount: payeeAccount || '', amount: amount || '', success: false, message: '明细缺少收款账号或金额' }); continue; }
    const type = String(payeeType || 'internal').toLowerCase();
    if (type === 'internal' || type === 'ues') {
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) { results.push({ payeeAccount, amount, success: false, message: '金额无效' }); continue; }
      const order = walletOrder({ outBizNo: walletNewNo('UEI'), payeeType: 'internal', payeeAccount, payeeName, amount: amt, remark, status: 'SUCCESS', channel: '自研结算通道·账本直结', mode: 'ledger' });
      WALLET_LEDGER.internal_flow += amt;
      okCount++;
      results.push({ payeeAccount, payeeName, amount: amt, success: true, outBizNo: order.outBizNo, message: '账本直结' });
    } else {
      const r = await execAlipayTransfer({ payeeAccount, payeeName, amount, remark, prefix: 'UEW' });
      if (r.success) { okCount++; results.push({ payeeAccount, payeeName, amount, success: true, outBizNo: r.data.outBizNo, message: '真实到账' }); }
      else { results.push({ payeeAccount, payeeName, amount, success: false, message: r.message }); }
    }
  }
  res.json({ success: okCount > 0, total: transfers.length, successCount: okCount, results });
});

// 6) 提现（internal 账本直结 / alipay 现实世界桥 / bank 待开通如实返回）
app.post('/wallet/api/v1/withdraw', async (req, res) => {
  const { payeeType, payeeAccount, payeeName, account, name, amount, remark } = req.body || {};
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.json(walletFail('金额无效', 'INVALID_PARAMETER'));
  const type = String(payeeType || '').toLowerCase();
  const acc = payeeAccount || account || '';
  const nm = payeeName || name || '';
  if (!acc) return res.json(walletFail('缺少收款账户', 'INVALID_PARAMETER'));
  if (type === 'internal' || type === 'ues' || payeeType === '全宇宙系统内部账户') {
    const order = walletOrder({ outBizNo: walletNewNo('UEI'), payeeType: 'internal', payeeAccount: acc, payeeName: nm, amount: amt, remark: remark || '全宇宙无限钱包提现', status: 'SUCCESS', channel: '自研结算通道·账本直结', mode: 'ledger' });
    WALLET_LEDGER.internal_flow += amt;
    return res.json(walletOk(Object.assign({}, order, { withdrawId: order.outBizNo, arriveTime: '实时到账', fee: '0.00' })));
  }
  if (type === 'alipay' || type === 'alipay_personal' || type === 'alipay_company') {
    const r = await execAlipayTransfer({ payeeAccount: acc, payeeName: nm, amount: amt, remark: remark || '全宇宙无限钱包提现', prefix: 'UEW' });
    if (r.success) return res.json(walletOk(Object.assign({}, r.data, { withdrawId: r.data.orderId, arriveTime: '实时到账', fee: '0.00' })));
    return res.json({ success: false, code: r.code || 'ALIPAY_ERROR', subCode: r.subCode || '', msg: r.message });
  }
  return res.json({ success: false, code: 'CHANNEL_NOT_OPEN', msg: '提现到银行卡渠道待开通：需先开通「单笔转账到银行卡」功能包，开通后钱包 API 即可真实提现到任意银行卡' });
});

// 7) 充值入账（现实世界桥入金）
app.post('/wallet/api/v1/recharge', (req, res) => {
  const { amount, channel } = req.body || {};
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.json(walletFail('金额无效', 'INVALID_PARAMETER'));
  WALLET_LEDGER.bridge.available_amount += amt;
  const order = walletOrder({ outBizNo: walletNewNo('UER'), payeeType: 'recharge', payeeAccount: '全宇宙无限钱包·现实世界桥', payeeName: '', amount: amt, remark: '充值入账（' + (channel || 'alipay') + '）', status: 'SUCCESS', channel: '现实世界桥·入金', mode: 'recharge' });
  res.json(walletOk({ orderNo: order.outBizNo, amount: amt, status: 'SUCCESS', channel: channel || 'alipay', bridgeBalance: WALLET_LEDGER.bridge.available_amount }));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('[真实支付宝后端] 运行于 :' + PORT + ' · 模式=' + MODE + ' · configured=' + cfgOk()));
