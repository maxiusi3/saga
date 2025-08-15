#!/bin/bash

# Vercel环境变量快速配置脚本
echo "🔧 Vercel环境变量配置助手"
echo "=================================="

# 检查Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ 请先安装Vercel CLI: npm i -g vercel"
    exit 1
fi

echo "✅ Vercel CLI已安装"
echo ""

# 检查登录状态
if ! vercel whoami &> /dev/null; then
    echo "🔐 请先登录Vercel:"
    vercel login
fi

echo "✅ 已登录Vercel"
echo ""

# 显示当前项目
echo "📊 当前项目信息:"
vercel ls | head -5

echo ""
echo "🎯 环境变量配置选项:"
echo "1. 手动在Vercel Dashboard配置 (推荐)"
echo "2. 使用CLI逐个配置"
echo "3. 查看配置模板"
echo "4. 验证当前配置"

read -p "请选择操作 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🌐 打开Vercel Dashboard进行配置:"
        echo "   1. 访问: https://vercel.com/dashboard"
        echo "   2. 选择你的项目"
        echo "   3. 进入 Settings → Environment Variables"
        echo "   4. 参考 VERCEL_ENVIRONMENT_VARIABLES_SETUP.md"
        ;;
    2)
        echo ""
        echo "⚙️  CLI配置模式"
        echo "请按照提示输入环境变量值 (留空跳过):"
        echo ""
        
        # Supabase配置
        read -p "NEXT_PUBLIC_SUPABASE_URL: " supabase_url
        if [ ! -z "$supabase_url" ]; then
            vercel env add NEXT_PUBLIC_SUPABASE_URL "$supabase_url" production
        fi
        
        read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " supabase_anon
        if [ ! -z "$supabase_anon" ]; then
            vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY "$supabase_anon" production
        fi
        
        read -p "SUPABASE_SERVICE_ROLE_KEY: " supabase_service
        if [ ! -z "$supabase_service" ]; then
            vercel env add SUPABASE_SERVICE_ROLE_KEY "$supabase_service" production
        fi
        
        echo "✅ 基础配置完成！"
        echo "💡 更多变量请参考配置文档"
        ;;
    3)
        echo ""
        echo "📋 配置模板 (复制到Vercel Dashboard):"
        echo ""
        cat << 'EOF'
# === Supabase配置 ===
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# === API配置 ===
NEXT_PUBLIC_API_URL=https://saga-backend.vercel.app
NEXT_PUBLIC_APP_URL=https://saga-app.vercel.app

# === OAuth配置 ===
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# === 支付配置 ===
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_or_test_key
STRIPE_SECRET_KEY=sk_live_or_test_key

# === 外部服务 ===
OPENAI_API_KEY=sk-proj-your_openai_key
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=saga-storage

# === 安全配置 ===
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
ENCRYPTION_KEY=your-32-char-encryption-key-here
SESSION_SECRET=your-session-secret-key-here
EOF
        ;;
    4)
        echo ""
        echo "🔍 当前环境变量配置:"
        vercel env ls
        ;;
    *)
        echo "❌ 无效选择"
        ;;
esac

echo ""
echo "📚 更多信息:"
echo "   • 配置文档: VERCEL_ENVIRONMENT_VARIABLES_SETUP.md"
echo "   • Vercel文档: https://vercel.com/docs/concepts/projects/environment-variables"
echo "   • 项目仓库: https://github.com/maxiusi3/saga"