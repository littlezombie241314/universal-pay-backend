# 全宇宙恒等系统 · 真实支付宝转账后端（部署仓库版）

生产模式 · 企业应用 2021005110624338 · 证书模式 · 零环境变量部署

## 一键部署（Render）

1. 将本仓库连接到 Render：`New + → Web Service → Connect a repository`
2. 构建/启动命令自动读取 `package.json`（`npm start` → `node server.js`）
3. 部署完成后地址：`https://<your-service>.onrender.com`
4. **无需配置任何环境变量**——配置全部随仓库：
   - `config.local.json` → 生产模式 + APPID
   - `certs/app_cert.pem` → 应用公钥证书
   - `certs/alipay_cert.pem` → 支付宝公钥证书
   - `certs/root_cert.pem` → 支付宝根证书
   - `certs/app_private_key.pem` → 应用私钥（PKCS8）
5. 验证：`GET /api/alipay/status` → `configured: true`

## 本地运行

```bash
npm install
node server.js   # 默认读取 config.local.json + certs/
```

## API

| 端点 | 说明 |
|---|---|
| `GET /api/alipay/status` | 通道配置状态 |
| `GET /api/alipay/diag` | 诊断（APPID/证书/私钥信息） |
| `POST /api/alipay/transfer` | 真实转账（需签约「转账到支付宝账户」） |
| `GET /api/alipay/transfer/query` | 转账结果查询 |
| `GET /api/alipay/balance` | 账户余额查询（需签约对应产品） |
| `GET /api/crypto/status` | 加密通道状态 |
| `POST /api/crypto/transfer` | 加密货币转账（需环境变量配置助记词） |

## 安全说明

- **仓库为私有**：`certs/app_private_key.pem` 为应用私钥，请勿公开本仓库或将私钥外泄。
- 转账接口**无鉴权**，公网部署建议在 Render 环境变量中配置 `API_TOKEN` 并自行加请求头校验（需要时联系维护者）。
- 金额校验：单笔默认上限 100,000 元（`TRANSFER_AMOUNT_LIMIT` 可调）。
