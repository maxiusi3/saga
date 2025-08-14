#!/bin/bash

# Saga Family Biography - 快速部署脚本
# GitHub + Supabase + Vercel 一键部署

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Saga Family Biography - 快速部署${NC}"
echo -e "${BLUE}======================================${NC}"

# 检查必要工具
echo -e "${YELLOW}🔍 检查必要工具...${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git 未安装${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 所有工具已就绪${NC}"

# 安装依赖
echo -e "\n${YELLOW}📦 安装项目依赖...${NC}"
npm ci

# 构建项目
echo -e "\n${YELLOW}🔨 构建项目...${NC}"
npm run build --workspace=packages/shared
npm run build --workspace=packages/web

# 运行测试
echo -e "\n${YELLOW}🧪 运行测试...${NC}"
npm run test --workspace=packages/shared
npm run test --workspace=packages/web

echo -e "\n${GREEN}✅ 项目构建和测试完成${NC}"

# 提供下一步指导
echo -e "\n${BLUE}📋 下一步操作指南:${NC}"
echo -e "\n${YELLOW}1. GitHub 设置:${NC}"
echo -e "   git remote add origin https://github.com/yourusername/saga-family-biography.git"
echo -e "   git push -u origin main"

echo -e "\n${YELLOW}2. Supabase 设置:${NC}"
echo -e "   • 访问 https://supabase.com 创建新项目"
echo -e "   • 运行: ./scripts/migrate-to-supabase.sh"
echo -e "   • 配置认证提供商 (Google, Apple)"

echo -e "\n${YELLOW}3. Vercel 部署:${NC}"
echo -e "   • 访问 https://vercel.com 连接 GitHub"
echo -e "   • 导入仓库，选择 packages/web 作为根目录"
echo -e "   • 配置环境变量 (见 DEPLOYMENT_CHECKLIST.md)"

echo -e "\n${YELLOW}4. 测试部署:${NC}"
echo -e "   • 测试用户注册和登录"
echo -e "   • 测试项目创建和故事录制"
echo -e "   • 验证支付功能"

echo -e "\n${GREEN}🎉 快速部署准备完成！${NC}"
echo -e "${BLUE}详细说明请查看: docs/GITHUB_SUPABASE_VERCEL_DEPLOYMENT.md${NC}"