#!/bin/bash

# API端点测试脚本
# 测试所有主要的API端点

set -e

API_BASE_URL="http://localhost:3001/api"
TEST_TOKEN=""

echo "🔗 测试API端点"
echo "=============="

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 测试健康检查
test_health_check() {
    log_info "测试健康检查端点..."
    
    response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$API_BASE_URL/health")
    
    if [ "$response" = "200" ]; then
        log_success "健康检查端点正常"
    else
        log_error "健康检查端点失败 (HTTP $response)"
    fi
}

# 测试用户认证
test_authentication() {
    log_info "测试用户认证端点..."
    
    # 测试登录
    login_response=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"zhang.wei@test.com","password":"TestPassword123!"}' \
        -o /tmp/login_response.json \
        "$API_BASE_URL/auth/login")
    
    if [ "$login_response" = "200" ]; then
        TEST_TOKEN=$(cat /tmp/login_response.json | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        log_success "用户登录成功"
    else
        log_error "用户登录失败 (HTTP $login_response)"
    fi
}

# 测试项目API
test_projects_api() {
    log_info "测试项目API端点..."
    
    if [ -z "$TEST_TOKEN" ]; then
        log_error "需要认证令牌，跳过项目API测试"
        return
    fi
    
    # 获取项目列表
    projects_response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -o /tmp/projects_response.json \
        "$API_BASE_URL/projects")
    
    if [ "$projects_response" = "200" ]; then
        log_success "获取项目列表成功"
    else
        log_error "获取项目列表失败 (HTTP $projects_response)"
    fi
}

# 测试故事API
test_stories_api() {
    log_info "测试故事API端点..."
    
    if [ -z "$TEST_TOKEN" ]; then
        log_error "需要认证令牌，跳过故事API测试"
        return
    fi
    
    # 获取故事列表
    stories_response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -o /tmp/stories_response.json \
        "$API_BASE_URL/stories")
    
    if [ "$stories_response" = "200" ]; then
        log_success "获取故事列表成功"
    else
        log_error "获取故事列表失败 (HTTP $stories_response)"
    fi
}

# 测试提示API
test_prompts_api() {
    log_info "测试提示API端点..."
    
    if [ -z "$TEST_TOKEN" ]; then
        log_error "需要认证令牌，跳过提示API测试"
        return
    fi
    
    # 获取下一个提示
    prompt_response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -o /tmp/prompt_response.json \
        "$API_BASE_URL/prompts/next/project-001")
    
    if [ "$prompt_response" = "200" ]; then
        log_success "获取提示成功"
    else
        log_error "获取提示失败 (HTTP $prompt_response)"
    fi
}

# 测试钱包API
test_wallet_api() {
    log_info "测试钱包API端点..."
    
    if [ -z "$TEST_TOKEN" ]; then
        log_error "需要认证令牌，跳过钱包API测试"
        return
    fi
    
    # 获取钱包余额
    wallet_response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -o /tmp/wallet_response.json \
        "$API_BASE_URL/wallets/facilitator-001")
    
    if [ "$wallet_response" = "200" ]; then
        log_success "获取钱包余额成功"
    else
        log_error "获取钱包余额失败 (HTTP $wallet_response)"
    fi
}

# 运行所有测试
main() {
    echo "开始API端点测试..."
    echo ""
    
    test_health_check
    test_authentication
    test_projects_api
    test_stories_api
    test_prompts_api
    test_wallet_api
    
    echo ""
    echo "API端点测试完成"
    
    # 清理临时文件
    rm -f /tmp/*_response.json
}

main "$@"
