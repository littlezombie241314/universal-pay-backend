# 全球工资发放系统 - 后端服务

对接支付宝、微信支付、银行、Stripe 等官方支付接口的真实转账后端服务。

## ⚠️ 重要说明

本系统需要**企业资质**和**真实资金账户**才能运行。纯前端静态网站（surge.sh）无法实现真实转账，必须部署本后端服务。

### 需要准备的资质

| 支付渠道 | 需要的资质 | 申请入口 | 审核周期 |
|---------|-----------|---------|---------|
| 支付宝转账 | 企业营业执照、对公账户 | https://open.alipay.com | 1-3个工作日 |
| 微信支付 | 企业营业执照、对公账户、商户号 | https://pay.weixin.qq.com | 1-5个工作日 |
| 银行卡转账 | 支付宝"转账到银行卡"产品或银联代付 | 支付宝开放平台 / 银联商户 | 3-7个工作日 |
| Stripe全球支付 | 海外企业主体或个人（部分国家） | https://stripe.com | 即时 |
| PayPal | 企业PayPal账户、Payouts权限 | https://developer.paypal.com | 1-3个工作日 |

## 🚀 快速开始

### 1. 安装依赖

```bash
cd universal-pay-backend
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的商户密钥：

```env
# 服务器
PORT=3000
FRONTEND_URL=https://universal-equality.surge.sh
API_KEY=your_secure_api_key

# 支付宝
ALIPAY_APP_ID=2021000000000000
ALIPAY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
ALIPAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# 微信支付
WECHAT_MCH_ID=1600000000
WECHAT_APP_ID=wx0000000000000000
WECHAT_API_V3_KEY=your_api_v3_key_32chars
WECHAT_MCH_SERIAL_NO=YOUR_MCH_CERT_SERIAL_NO
WECHAT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Stripe
STRIPE_SECRET_KEY=sk_live_your_secret_key
```

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 4. 验证服务

```bash
curl http://localhost:3000/health
```

## 📡 API 接口文档

### 通用说明

- 所有 `/api/*` 接口需要在请求头携带 `X-API-Key: your_api_key`
- 请求和响应均为 JSON 格式
- 金额单位：元（人民币）/ 美元（Stripe），接口内部自动转换为分

### 支付宝接口

#### 单笔转账
```
POST /api/alipay/transfer
Content-Type: application/json
X-API-Key: your_api_key

{
  "payeeAccount": "user@example.com",  // 支付宝账号或手机号
  "payeeName": "张三",                   // 收款方姓名（可选）
  "amount": 100.50,                      // 转账金额（元）
  "remark": "工资发放",                   // 备注（可选）
  "orderTitle": "全民基本收入"            // 订单标题（可选）
}
```

#### 批量转账（最多100笔）
```
POST /api/alipay/batch-transfer
{
  "transfers": [
    { "payeeAccount": "user1@example.com", "amount": 100, "payeeName": "张三" },
    { "payeeAccount": "user2@example.com", "amount": 200, "payeeName": "李四" }
  ]
}
```

#### 查询转账状态
```
POST /api/alipay/query
{ "outBizNo": "商户订单号" 或 "orderId": "支付宝订单号" }
```

#### 查询账户余额
```
POST /api/alipay/balance
```

### 微信支付接口

#### 商家转账到零钱
```
POST /api/wechat/transfer
{
  "openid": "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o",  // 用户openid
  "amount": 100.50,                               // 金额（元，0.1-2000）
  "remark": "工资发放",                            // 备注
  "userName": "张三"                               // 收款方姓名（可选，校验用）
}
```

#### 批量转账（最多200笔）
```
POST /api/wechat/batch-transfer
{
  "batchName": "8月工资发放",
  "batchRemark": "全民基本收入",
  "transfers": [
    { "openid": "oUpF8...", "amount": 100, "userName": "张三" },
    { "openid": "oUpF8...", "amount": 200, "userName": "李四" }
  ]
}
```

#### 查询转账批次
```
GET /api/wechat/batch/:outBatchNo
```

### 银行转账接口

#### 支付宝转账到银行卡
```
POST /api/bank/alipay-bank-transfer
{
  "bankCardNo": "6222021234567890123",  // 银行卡号
  "bankName": "中国工商银行",               // 银行名称
  "accountName": "张三",                    // 开户名
  "amount": 5000,                           // 金额（元）
  "remark": "工资发放"
}
```

#### 银联企业代付
```
POST /api/bank/unionpay-transfer
{
  "bankCardNo": "6222021234567890123",
  "bankName": "中国工商银行",
  "accountName": "张三",
  "amount": 5000,
  "phone": "13800138000"
}
```

### 全球金融账户接口

#### Stripe转账到Connect账户
```
POST /api/global/stripe-transfer
{
  "destination": "acct_...",     // 目标Stripe账户ID
  "amount": 100.50,               // 金额
  "currency": "usd",               // 货币
  "description": "工资发放"
}
```

#### Stripe Payout（到银行账户）
```
POST /api/global/stripe-payout
{
  "amount": 1000,
  "currency": "usd",
  "description": "工资发放",
  "destination": "ba_..."  // 银行账户ID（可选）
}
```

#### 创建Stripe Connect账户
```
POST /api/global/stripe-create-account
{
  "email": "user@example.com",
  "country": "US",
  "type": "express"
}
```

#### PayPal转账
```
POST /api/global/paypal-payout
{
  "recipientEmail": "user@example.com",
  "amount": 100.50,
  "currency": "USD",
  "note": "工资发放"
}
```

#### SWIFT国际转账
```
POST /api/global/swift-transfer
{
  "iban": "GB82WEST12345698765432",
  "swiftCode": "DEUTDEFF",
  "bankName": "Deutsche Bank",
  "accountName": "John Doe",
  "amount": 1000,
  "currency": "USD",
  "country": "DE"
}
```

### 统一工资发放接口

```
POST /api/salary/distribute
{
  "amountPerPerson": 9999.99,
  "platforms": ["alipay", "wechat", "bank", "global"],
  "users": [
    { "id": "user001", "platform": "alipay", "account": "user@example.com", "name": "张三" },
    { "id": "user002", "platform": "wechat", "openid": "oUpF8...", "name": "李四" },
    { "id": "user003", "platform": "bank", "bankCard": "6222...", "name": "王五" },
    { "id": "user004", "platform": "global", "account": "user@example.com", "name": "John" }
  ]
}
```

## 🏗️ 生产环境部署

### 方案一：云服务器（推荐）

1. **购买云服务器**：阿里云/腾讯云/AWS，最低配置2核4G
2. **安装Node.js**：v16+
3. **安装PM2进程管理**：
```bash
npm install -g pm2
pm2 start server.js --name universal-pay
pm2 save
pm2 startup
```

4. **配置Nginx反向代理 + HTTPS**：
```nginx
server {
    listen 443 ssl;
    server_name pay.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

5. **域名备案**（中国大陆服务器必需）

### 方案二：Serverless（Vercel / AWS Lambda）

将 `server.js` 改造为 Serverless Function，适合流量不大的场景。

### 方案三：Docker部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

## 🔐 安全注意事项

1. **永远不要提交 `.env` 文件到代码仓库**
2. API Key 使用高强度随机字符串
3. 生产环境必须使用 HTTPS
4. 配置IP白名单，只允许前端服务器调用API
5. 定期轮换商户密钥和API证书
6. 开启支付接口的回调签名验证
7. 设置单笔和日累计转账限额
8. 记录完整的转账日志，便于对账和审计

## 📊 费率参考

| 支付渠道 | 转账手续费 | 到账时间 | 单笔限额 |
|---------|-----------|---------|---------|
| 支付宝转账 | 0.1%（最低1元，最高10元） | 实时 | 5万元 |
| 微信商家转账 | 0.1%（最低1元） | 实时 | 2000元 |
| 银行卡转账（支付宝） | 0.1%（最低1元，最高10元） | 2小时内 | 5万元 |
| 银联代付 | 按笔计费（约1-5元/笔） | 1-2工作日 | 5万元 |
| Stripe转账 | 0.5% + 固定费用 | 1-2工作日 | 按账户 |
| PayPal Payouts | 2% + 固定费用 | 1-3工作日 | 按账户 |

## 📞 技术支持

- 支付宝开放平台：https://opendocs.alipay.com
- 微信支付：https://pay.weixin.qq.com/doc
- Stripe文档：https://stripe.com/docs/api
- PayPal开发者：https://developer.paypal.com/docs
