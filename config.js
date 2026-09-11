require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  frontendUrl: process.env.FRONTEND_URL || '*',
  apiKey: process.env.API_KEY || 'dev-api-key-123456',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',

  // ============ 中国区金融机构 ============

  alipay: {
    appId: process.env.ALIPAY_APP_ID,
    privateKey: process.env.ALIPAY_PRIVATE_KEY,
    publicKey: process.env.ALIPAY_PUBLIC_KEY,
    gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
    signType: process.env.ALIPAY_SIGN_TYPE || 'RSA2',
    useCert: process.env.ALIPAY_USE_CERT === 'true',
    appCertPath: process.env.ALIPAY_APP_CERT_PATH,
    alipayCertPath: process.env.ALIPAY_ALIPAY_CERT_PATH,
    alipayRootCertPath: process.env.ALIPAY_ROOT_CERT_PATH,
    // 单笔转账到支付宝账户
    transferProduct: process.env.ALIPAY_TRANSFER_PRODUCT || 'TRANS_ACCOUNT_NO_PWD',
    transferBizScene: process.env.ALIPAY_TRANSFER_BIZ_SCENE || 'DIRECT_TRANSFER',
  },

  wechat: {
    mchId: process.env.WECHAT_MCH_ID,
    appId: process.env.WECHAT_APP_ID,
    apiV3Key: process.env.WECHAT_API_V3_KEY,
    mchSerialNo: process.env.WECHAT_MCH_SERIAL_NO,
    privateKey: process.env.WECHAT_PRIVATE_KEY,
    platformCert: process.env.WECHAT_PLATFORM_CERT,
    // 企业付款到零钱
    transferApiUrl: process.env.WECHAT_TRANSFER_API_URL || 'https://api.mch.weixin.qq.com/v3/transfer/batches',
  },

  unionpay: {
    // 银联云闪付
    merId: process.env.UNIONPAY_MER_ID,
    appId: process.env.UNIONPAY_APP_ID,
    privateKey: process.env.UNIONPAY_PRIVATE_KEY,
    publicKey: process.env.UNIONPAY_PUBLIC_KEY,
    certPath: process.env.UNIONPAY_CERT_PATH,
    apiUrl: process.env.UNIONPAY_API_URL || 'https://api.95516.com',
  },

  ecny: {
    // 数字人民币
    walletId: process.env.ECNY_WALLET_ID,
    appId: process.env.ECNY_APP_ID,
    privateKey: process.env.ECNY_PRIVATE_KEY,
    apiUrl: process.env.ECNY_API_URL || 'https://api.pbc.gov.cn/dcep',
    operatorId: process.env.ECNY_OPERATOR_ID,
  },

  bank: {
    // 通用银行接口（支持多家银行）
    apiUrl: process.env.BANK_API_URL,
    partnerId: process.env.BANK_PARTNER_ID,
    privateKey: process.env.BANK_PRIVATE_KEY,
    publicKey: process.env.BANK_PUBLIC_KEY,
    // 支持的银行列表
    supportedBanks: (process.env.BANK_SUPPORTED || 'ICBC,CCB,ABC,BOC,CMB,PSBC,COMM,CITIC,CEB,SPDB').split(','),
  },

  // ============ 国际金融机构 ============

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    apiVersion: process.env.STRIPE_API_VERSION || '2024-06-20',
    // Stripe Connect 转账
    transferEnabled: process.env.STRIPE_TRANSFER_ENABLED === 'true',
  },

  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    mode: process.env.PAYPAL_MODE || 'sandbox', // sandbox 或 live
    apiUrl: process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com',
    // Payouts 批量付款
    payoutsEnabled: process.env.PAYPAL_PAYOUTS_ENABLED === 'true',
  },

  swift: {
    // SWIFT 国际汇款
    apiUrl: process.env.SWIFT_API_URL,
    apiKey: process.env.SWIFT_API_KEY,
    // 代理银行信息
    intermediaryBank: process.env.SWIFT_INTERMEDIARY_BANK,
    intermediarySwift: process.env.SWIFT_INTERMEDIARY_SWIFT,
    // 支持的币种
    supportedCurrencies: (process.env.SWIFT_CURRENCIES || 'USD,EUR,GBP,JPY,CNY,HKD,AUD,CAD,CHF').split(','),
  },

  wise: {
    // Wise (原TransferWise) 国际汇款
    apiToken: process.env.WISE_API_TOKEN,
    profileId: process.env.WISE_PROFILE_ID,
    apiUrl: process.env.WISE_API_URL || 'https://api.transferwise.com',
    sandbox: process.env.WISE_SANDBOX === 'true',
  },

  // ============ 数字钱包 ============

  applePay: {
    merchantId: process.env.APPLEPAY_MERCHANT_ID,
    privateKey: process.env.APPLEPAY_PRIVATE_KEY,
    certPath: process.env.APPLEPAY_CERT_PATH,
    processingGateway: process.env.APPLEPAY_GATEWAY || 'stripe',
  },

  googlePay: {
    merchantId: process.env.GOOGLEPAY_MERCHANT_ID,
    privateKey: process.env.GOOGLEPAY_PRIVATE_KEY,
    processingGateway: process.env.GOOGLEPAY_GATEWAY || 'stripe',
  },

  // ============ 加密货币 ============

  crypto: {
    // 加密货币支付（支持BTC, ETH, USDT等）
    apiKey: process.env.CRYPTO_API_KEY,
    apiSecret: process.env.CRYPTO_API_SECRET,
    walletAddress: process.env.CRYPTO_WALLET_ADDRESS,
    // 支持的币种
    supportedCoins: (process.env.CRYPTO_COINS || 'BTC,ETH,USDT,USDC,BNB,SOL').split(','),
    // 网络
    networks: (process.env.CRYPTO_NETWORKS || 'ERC20,TRC20,BEP20').split(','),
  },

  // ============ 其他区域支付 ============

  // 东南亚
  grabPay: {
    merchantId: process.env.GRABPAY_MERCHANT_ID,
    clientId: process.env.GRABPAY_CLIENT_ID,
    clientSecret: process.env.GRABPAY_CLIENT_SECRET,
    apiUrl: process.env.GRABPAY_API_URL,
  },

  gojek: {
    merchantId: process.env.GOJEK_MERCHANT_ID,
    apiKey: process.env.GOJEK_API_KEY,
    apiUrl: process.env.GOJEK_API_URL,
  },

  // 印度
  upi: {
    // 印度UPI支付
    merchantId: process.env.UPI_MERCHANT_ID,
    vpa: process.env.UPI_VPA, // Virtual Payment Address
    apiKey: process.env.UPI_API_KEY,
    apiUrl: process.env.UPI_API_URL,
  },

  // 韩国
  kakaoPay: {
    cid: process.env.KAKAOPAY_CID,
    adminKey: process.env.KAKAOPAY_ADMIN_KEY,
    apiUrl: process.env.KAKAOPAY_API_URL || 'https://kapi.kakao.com',
  },

  // 日本
  paypay: {
    merchantId: process.env.PAYPAY_MERCHANT_ID,
    apiKey: process.env.PAYPAY_API_KEY,
    apiSecret: process.env.PAYPAY_API_SECRET,
    apiUrl: process.env.PAYPAY_API_URL,
  },

  // 拉美
  mercadopago: {
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    publicKey: process.env.MERCADOPAGO_PUBLIC_KEY,
    apiUrl: process.env.MERCADOPAGO_API_URL || 'https://api.mercadopago.com',
  },

  // 非洲
  mpesa: {
    // 肯尼亚M-Pesa
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    apiUrl: process.env.MPESA_API_URL || 'https://sandbox.safaricom.co.ke',
  },

  // ============ 全宇宙统一账户 ============

  universal: {
    // 全宇宙统一金融账户（系统内部账户）
    enabled: true,
    accountPrefix: process.env.UNIVERSAL_ACCOUNT_PREFIX || 'UE',
    // 内部转账手续费（0表示免费）
    transferFee: parseFloat(process.env.UNIVERSAL_TRANSFER_FEE || '0'),
    // 每日转账限额（0表示无限）
    dailyLimit: parseFloat(process.env.UNIVERSAL_DAILY_LIMIT || '0'),
  },
};
