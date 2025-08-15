# Vercel 404 错误诊断和修复方案

## 问题描述

虽然 Vercel 部署显示成功，但访问网站时出现 404 错误：
```
404: NOT_FOUND
Code: NOT_FOUND
ID: lhr1::vt9t8-1755259759701-52a5e5c7ab9b
```

## 根本原因分析

### 1. 项目根目录配置问题
- Vercel 项目期望从 `packages/web` 目录部署
- 但构建命令试图访问父目录的 `packages/shared`
- 导致路径解析错误：`/vercel/path0/packages/web/packages/web/.next/routes-manifest.json`

### 2. Monorepo 结构挑战
- 项目使用 monorepo 结构
- `packages/web` 依赖 `packages/shared`
- Vercel 无法正确处理跨包依赖

### 3. 构建输出路径错误
- 期望路径：`packages/web/.next`
- 实际路径：`packages/web/packages/web/.next`（重复路径）

## 解决方案

### 方案 1：修复 Vercel 项目根目录设置（推荐）

1. **通过 Vercel Dashboard 修复**：
   - 访问：https://vercel.com/fangzero-3350s-projects/saga-web/settings
   - 在 "General" 设置中找到 "Root Directory"
   - 将根目录设置为 `.`（项目根目录）而不是 `packages/web`

2. **更新 vercel.json 配置**：
```json
{
  "buildCommand": "npm run build:vercel",
  "outputDirectory": "packages/web/.next",
  "installCommand": "npm ci",
  "framework": "nextjs"
}
```

### 方案 2：创建独立的 Web 项目

1. **在 packages/web 目录创建独立项目**：
```bash
cd packages/web
vercel --prod --name saga-web-standalone
```

2. **修改 package.json 构建脚本**：
```json
{
  "scripts": {
    "build": "npm run build:shared && next build",
    "build:shared": "cd ../shared && npm run build"
  }
}
```

### 方案 3：使用 Vercel Monorepo 配置

1. **创建 vercel.json**：
```json
{
  "version": 2,
  "builds": [
    {
      "src": "packages/web/package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "packages/web/$1"
    }
  ]
}
```

## 当前状态

### ✅ 成功的部署
- **URL**: https://saga-dg059n4jd-fangzero-3350s-projects.vercel.app
- **状态**: Ready（1小时前）
- **构建时间**: 1分钟

### ❌ 失败的部署
- **最新**: https://saga-l5ql2e9tf-fangzero-3350s-projects.vercel.app
- **错误**: routes-manifest.json 文件未找到
- **原因**: 路径配置错误

## 立即修复步骤

### 步骤 1：通过 Vercel Dashboard 修复
```bash
# 1. 访问 Vercel 项目设置
open https://vercel.com/fangzero-3350s-projects/saga-web/settings

# 2. 修改 Root Directory 设置
# 从 "packages/web" 改为 "."

# 3. 重新部署
vercel --prod
```

### 步骤 2：验证修复
```bash
# 检查部署状态
vercel ls

# 测试网站访问
curl -I https://saga-web-fangzero-3350s-projects.vercel.app
```

## 预防措施

### 1. 项目结构优化
- 考虑将 shared 包发布到 npm
- 或使用 Vercel 的 monorepo 最佳实践

### 2. 部署脚本
- 创建自动化部署脚本
- 包含构建验证和部署检查

### 3. 监控设置
- 设置 Vercel 部署通知
- 配置健康检查端点

## 技术细节

### 当前 vercel.json 配置
```json
{
  "buildCommand": "npm run build:vercel",
  "outputDirectory": "packages/web/.next",
  "installCommand": "npm ci",
  "framework": "nextjs"
}
```

### 构建命令流程
```bash
npm run build:vercel
├── cd packages/shared && npm run build
└── cd packages/web && npm run build
```

### 文件结构
```
saga传奇/
├── packages/
│   ├── shared/          # 共享类型和工具
│   └── web/            # Next.js 应用
│       └── .next/      # 构建输出
├── vercel.json         # Vercel 配置
└── package.json        # 根包配置
```

## 总结

主要问题是 Vercel 项目的根目录设置不正确，导致路径解析错误。通过修复 Vercel Dashboard 中的根目录设置，应该能够解决 404 错误问题。

---
*诊断时间: 2025-08-15 21:10*
*状态: 待修复*
*优先级: 高*