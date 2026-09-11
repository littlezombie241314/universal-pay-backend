#!/bin/bash
# ============================================
# 全球工资发放系统 - 一键启动脚本
# 适用于：本地电脑 / 云服务器（Linux/Mac）
# ============================================

set -e

echo "============================================"
echo "  全球工资发放系统 - 后端服务一键启动"
echo "============================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js 16+"
    echo "   下载地址：https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js 版本：$(node --version)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 未检测到 npm"
    exit 1
fi
echo "✅ npm 版本：$(npm --version)"

# 进入脚本所在目录
cd "$(dirname "$0")"

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 正在安装依赖..."
    npm install --production
    echo "✅ 依赖安装完成"
else
    echo "✅ 依赖已存在，跳过安装"
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠️  未检测到 .env 配置文件，正在从模板创建..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件"
    echo ""
    echo "⚠️  重要：请编辑 .env 文件，填入你的商户密钥："
    echo "   - ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY"
    echo "   - WECHAT_MCH_ID / WECHAT_API_V3_KEY"
    echo "   - STRIPE_SECRET_KEY（可选）"
    echo ""
    read -p "配置完成后按回车继续，或按 Ctrl+C 退出..." -n1 -s
fi

# 创建日志目录
mkdir -p logs

# 检查端口占用
PORT=${PORT:-3000}
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo ""
    echo "⚠️  端口 $PORT 已被占用，正在停止旧进程..."
    lsof -Pi :$PORT -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# 启动服务
echo ""
echo "🚀 正在启动后端服务..."
echo "   服务地址：http://localhost:$PORT"
echo "   健康检查：http://localhost:$PORT/health"
echo "   API 文档：见 README.md"
echo ""
echo "   按 Ctrl+C 停止服务"
echo "============================================"
echo ""

# 检查是否安装了 pm2
if command -v pm2 &> /dev/null; then
    echo "📌 检测到 pm2，使用 pm2 启动（后台运行）"
    pm2 start server.js --name universal-pay --update-env
    pm2 save
    echo ""
    echo "✅ 服务已通过 pm2 启动"
    echo "   查看日志：pm2 logs universal-pay"
    echo "   停止服务：pm2 stop universal-pay"
else
    echo "📌 直接启动（前台运行）"
    echo "   如需后台运行，请安装 pm2：npm install -g pm2"
    echo ""
    node server.js
fi
