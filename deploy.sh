#!/bin/bash
# ============================================
# 全球工资发放系统 - 云服务器一键部署脚本
# 适用于：Ubuntu 20.04+ / Debian 10+ / CentOS 7+
# 使用方法：将本脚本和项目文件上传到服务器，执行 bash deploy.sh
# ============================================

set -e

echo "============================================"
echo "  全球工资发放系统 - 云服务器一键部署"
echo "============================================"
echo ""

# 检测系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    OS=$(uname -s)
    VER=$(uname -r)
fi
echo "📋 操作系统：$OS $VER"
echo ""

# 安装 Node.js
if ! command -v node &> /dev/null; then
    echo "📦 正在安装 Node.js 18..."
    if command -v apt &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
    else
        echo "❌ 不支持的系统，请手动安装 Node.js 18+"
        exit 1
    fi
    echo "✅ Node.js 安装完成：$(node --version)"
else
    echo "✅ Node.js 已安装：$(node --version)"
fi

# 安装 pm2
if ! command -v pm2 &> /dev/null; then
    echo "📦 正在安装 pm2 进程管理器..."
    npm install -g pm2
    echo "✅ pm2 安装完成"
else
    echo "✅ pm2 已安装"
fi

# 进入项目目录
cd "$(dirname "$0")"
PROJECT_DIR=$(pwd)
echo "📂 项目目录：$PROJECT_DIR"

# 安装依赖
echo ""
echo "📦 正在安装项目依赖..."
npm install --production
echo "✅ 依赖安装完成"

# 创建 .env 文件
if [ ! -f ".env" ]; then
    echo ""
    echo "⚙️  正在创建配置文件..."
    cp .env.example .env
    
    # 自动生成安全的 API Key 和 JWT Secret
    RANDOM_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    RANDOM_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    
    sed -i "s/^API_KEY=.*/API_KEY=$RANDOM_API_KEY/" .env
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$RANDOM_JWT_SECRET/" .env
    sed -i "s/^NODE_ENV=.*/NODE_ENV=production/" .env
    
    echo "✅ 配置文件已创建，已自动生成安全密钥"
    echo ""
    echo "⚠️  重要：请编辑 .env 文件，填入你的商户密钥："
    echo "   nano $PROJECT_DIR/.env"
    echo ""
    echo "   需要配置的项："
    echo "   - ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY"
    echo "   - WECHAT_MCH_ID / WECHAT_API_V3_KEY / WECHAT_PRIVATE_KEY"
    echo "   - FRONTEND_URL（你的前端网站域名）"
    echo ""
    read -p "配置完成后按回车继续..." -n1 -s
fi

# 创建日志目录
mkdir -p logs

# 配置防火墙
echo ""
echo "🔥 正在配置防火墙（开放 3000 端口）..."
if command -v ufw &> /dev/null; then
    ufw allow 3000/tcp 2>/dev/null || true
    echo "✅ UFW 防火墙已配置"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    echo "✅ firewalld 已配置"
else
    echo "⚠️  未检测到防火墙工具，请手动开放 3000 端口"
fi

# 停止旧服务
pm2 delete universal-pay 2>/dev/null || true

# 启动服务
echo ""
echo "🚀 正在启动服务..."
pm2 start server.js --name universal-pay --update-env
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# 等待服务启动
sleep 3

# 验证服务
echo ""
echo "🔍 正在验证服务..."
HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null || echo "failed")
if echo "$HEALTH" | grep -q "ok"; then
    echo "✅ 服务启动成功！"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
    echo "⚠️  服务可能未正常启动，请检查日志：pm2 logs universal-pay"
fi

# 获取服务器IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "your-server-ip")

echo ""
echo "============================================"
echo "  ✅ 部署完成！"
echo "============================================"
echo ""
echo "📡 服务信息："
echo "   本地地址：http://localhost:3000"
echo "   公网地址：http://$SERVER_IP:3000"
echo "   健康检查：http://$SERVER_IP:3000/health"
echo ""
echo "🔑 你的 API Key："
grep "^API_KEY=" .env | cut -d'=' -f2
echo ""
echo "📝 常用命令："
echo "   查看日志：pm2 logs universal-pay"
echo "   重启服务：pm2 restart universal-pay"
echo "   停止服务：pm2 stop universal-pay"
echo "   查看状态：pm2 status"
echo ""
echo "🌐 前端配置："
echo "   在前端网站的'全球工资发放系统'中："
echo "   1. 转账模式选择'真实转账（需后端）'"
echo "   2. 后端API填写：http://$SERVER_IP:3000"
echo "   3. API Key填写上面的密钥"
echo "   4. 点击'测试连接'"
echo ""
echo "⚠️  生产环境建议："
echo "   1. 配置 Nginx 反向代理 + HTTPS 证书"
echo "   2. 域名解析到服务器IP"
echo "   3. 在 .env 中设置 FRONTEND_URL 为你的前端域名"
echo "   4. 云服务器安全组开放 3000 端口"
echo "============================================"
