# 下一步行动指南

**当前状态**: ✅ 8/10 P0问题已修复 (80%)  
**验证状态**: ✅ 所有测试通过  
**Git提交**: 79b9a6d32 + 文档提交

---

## 🚀 立即执行（部署前必做）

### 1. 应用数据库迁移 (15分钟)

```bash
cd /Users/eat/Documents/eatpotato/saga传奇/supabase

# 1. 确保Supabase CLI已登录
supabase login

# 2. 链接到你的项目（如果还没链接）
supabase link --project-ref <your-project-ref>

# 3. 应用迁移
supabase db push

# 4. 验证RPC函数已创建（应返回6行）
supabase db execute "
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'initialize_user_wallet',
  'process_package_purchase',
  'send_project_invitation',
  'accept_project_invitation',
  'cleanup_expired_invitations',
  'request_data_export'
);"

# 5. 验证钱包RLS策略（应只有SELECT策略）
supabase db execute "
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'user_resource_wallets';"
```

**预期结果**:

- ✅ 6个RPC函数已创建
- ✅ `user_resource_wallets` 只有 `wallet_select_self (SELECT)` 策略
- ✅ 无 UPDATE/INSERT 策略

---

### 2. 运行安全测试 (10分钟)

在开发环境启动应用后执行：

```bash
cd /Users/eat/Documents/eatpotato/saga传奇
npm run dev  # 启动开发服务器

# 在另一个终端执行测试
export DEV_URL="http://localhost:3000"
export TEST_TOKEN="<your-dev-token>"
export TEST_USER_ID="<your-user-id>"
export OTHER_USER_ID="<another-user-id>"

# 测试1: 未认证删除（应401）
curl -X POST $DEV_URL/api/media/delete-image \
  -H "Content-Type: application/json" \
  -d '{"paths": ["test/file.webm"]}' \
  | jq

# 测试2: 跨用户删除（应403）
curl -X POST $DEV_URL/api/media/delete-image \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"paths\": [\"$OTHER_USER_ID/recording.webm\"]}" \
  | jq

# 测试3: 合法删除（应200）
curl -X POST $DEV_URL/api/media/delete-image \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"paths\": [\"$TEST_USER_ID/test.webm\"]}" \
  | jq
```

**预期结果**:

- ✅ 测试1返回 `{"error": "Unauthorized"}` 401
- ✅ 测试2返回 `{"error": "Unauthorized: Cannot delete..."}` 403
- ✅ 测试3返回 `{"message": "...deleted successfully"}` 200

---

### 3. 测试转录功能 (5分钟)

```bash
# 测试小文件直传模式
curl -X POST $DEV_URL/api/ai/transcribe \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -F "audio=@test_audio_2min.webm" \
  -F "language=zh-CN" \
  | jq

# 测试Storage路径模式（先上传文件到Storage）
# 然后:
curl -X POST $DEV_URL/api/ai/transcribe \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -F "storagePath=$TEST_USER_ID/recordings/test_long.webm" \
  -F "language=zh-CN" \
  | jq
```

**预期结果**:

- ✅ 小文件模式成功转录
- ✅ Storage路径模式成功转录
- ✅ 无4.5MB大小错误

---

## 📅 短期任务（1-2天内）

### 4. 完成SEC-05: npm依赖漏洞修复

```bash
cd /Users/eat/Documents/eatpotato/saga传奇

# 1. 检查npm audit fix结果（应该已完成）
npm audit --workspace=packages/web

# 2. 如果还有Critical漏洞，手动升级
npm outdated --workspace=packages/web
npm update <package-name> --workspace=packages/web

# 3. 运行回归测试
npm run verify

# 4. 如果测试通过，提交
git add package*.json
git commit -m "Fix npm security vulnerabilities (SEC-05)

Upgraded dependencies to address 70 vulnerabilities
All tests passing after upgrade

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### 5. 存储RLS审计（2小时）

```bash
# 审计Storage bucket策略
supabase db execute "
SELECT * FROM storage.policies WHERE bucket_id = 'saga';
"

# 验证用户只能访问自己的路径
# 策略应确保: {userId}/* 只能被该用户CRUD

# 审计项目成员表
supabase db execute "
SELECT * FROM pg_policies WHERE tablename = 'project_members';
"

# 验证用户不能随意添加/移除成员
# 应通过RPC强制权限检查
```

**检查要点**:

- ✅ Storage路径隔离（用户ID前缀）
- ✅ 项目成员表RLS正确
- ✅ 无绕过邀请系统的写入路径

**如发现问题**:

1. 记录到 `/docs/storage-rls-audit.md`
2. 创建新的迁移脚本修复
3. 测试验证后提交

---

## 🎯 中期计划（1周内）

### 6. AI Agent升级（4-6小时）

按Q7决策的混合方案：

```bash
# 保持Interview Agent模板不变（成本可控）
# 升级Editor Agent为OpenAI Structured Outputs

# 1. 修改 packages/web/src/lib/agents/editor-agent.ts
#    - 移除regex解析逻辑
#    - 使用 OpenAI Structured Outputs
#    - 定义 StoryElement JSON Schema

# 2. 更新 packages/web/src/lib/ai-service.ts
#    - 调用OpenAI API with response_format

# 3. 测试非英语故事解析
#    - 中文故事
#    - 日文故事
#    - 混合语言故事

# 4. 编写单元测试
npm test --workspace=packages/web -- editor-agent
```

---

### 7. 音频处理方案研究（2-3小时）

按Q3决策B：

```bash
# 1. GitHub搜索最佳实践
# 搜索关键词: 
# - "audio normalization web app"
# - "ffmpeg lambda audio processing"
# - "audio quality enhancement pipeline"

# 2. 评估方案:
# - FFmpeg + AWS Lambda
# - Cloudflare Workers + WebAssembly
# - 第三方服务 (Dolby.io, Auphonic)

# 3. 更新PRD
# 编辑 /UR saga v1.8.md
# - 移除 "NPR-grade audio processing" 承诺
# - 添加 "Future: Audio enhancement pipeline" 章节
# - 记录研究的3个候选方案

# 4. 提交PRD更新
git add "UR saga v1.8.md"
git commit -m "Update PRD: Clarify audio processing roadmap (AUD-01)

- Remove immediate 'NPR-grade processing' promise
- Document 3 candidate solutions for future implementation
- Current: Raw webm recordings satisfy transcription needs"
```

---

### 8. Waitlist UI实现（3-4小时）

按Q2决策：

```bash
# 1. 修改购买页面
# 文件: packages/web/src/app/[locale]/dashboard/purchase/page.tsx

# 替换mock setTimeout为:
# - "即将开放" 横幅
# - 邮件收集表单
# - "加入等候名单" CTA

# 2. 创建waitlist API
# 文件: packages/web/src/app/api/waitlist/route.ts
# - 验证邮件格式
# - 存储到 waitlist_signups 表
# - 发送确认邮件（可选）

# 3. 创建数据库表
# 文件: supabase/migrations/20261007000001_create_waitlist.sql

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  package_interest TEXT, -- 'standard' or 'premium'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ
);

# 4. 测试流程
# - 填写表单
# - 验证邮件存储
# - 检查重复提交处理
```

---

## 📊 进度追踪

创建一个简单的追踪文件：

```bash
cat > /Users/eat/Documents/eatpotato/saga传奇/docs/remediation-progress.md << 'EOF'
# P0修复进度追踪

## 阶段1: 核心修复 ✅ (已完成)
- [x] SEC-01: 媒体删除认证
- [x] SEC-02: 钱包RLS锁定
- [x] SEC-03: RPC函数实现
- [x] AUD-03: 转录突破限制
- [x] AUD-04: 导出Beta标记
- [x] AUD-05: 移除虚假数据
- [x] MISC-03: 删除测试页面
- [x] 数据库迁移脚本

## 阶段2: 部署准备 🔄 (进行中)
- [ ] 应用数据库迁移
- [ ] 运行安全测试
- [ ] 测试转录功能
- [ ] SEC-05: npm漏洞修复
- [ ] 存储RLS审计

## 阶段3: 补充优化 ⏸️ (待开始)
- [ ] AI Agent升级
- [ ] 音频处理方案研究
- [ ] Waitlist UI实现

## 时间线
- 2026-10-06: 阶段1完成 ✅
- 2026-10-07: 阶段2目标完成日期
- 2026-10-13: 阶段3目标完成日期

## 最后更新: 2026-10-06 21:30
EOF

git add docs/remediation-progress.md
git commit -m "Add remediation progress tracking"
```

---

## 🔔 关键提醒

### ⚠️ 部署前必须完成

1. **数据库迁移** - 必须应用，否则邀请/支付/钱包功能全部损坏
2. **安全测试** - 验证SEC-01/02修复，防止生产数据泄露
3. **SEC-05修复** - 等待npm audit完成，确保无Critical漏洞

### 📧 需要人工决策的事项

1. **支付上线时机** - Waitlist模式何时切换到真实支付？
2. **音频处理方案** - 3个候选方案选哪个？预算多少？
3. **Beta功能迭代** - 导出音频/照片何时排期？

### 🎯 成功标准

- ✅ 所有P0安全漏洞已修复
- ✅ 核心功能可用（录音/转录/存储/导出）
- ✅ 用户清楚了解Beta限制
- ✅ 数据库事务安全
- ✅ 所有测试通过

---

## 📞 需要帮助时

如果遇到问题，按优先级执行：

1. **数据库迁移失败** → 检查 `/docs/P0-remediation-summary.md` 中的SQL语句
2. **测试不通过** → 查看 `/docs/phase1-security-fixes-completed.md` 中的测试用例
3. **功能理解疑问** → 参考 `/docs/phase2-core-fixes-completed.md` 中的详细说明
4. **整体规划问题** → 阅读 `/docs/EXEC-SUMMARY.md` 执行摘要

---

**本指南生成**: 2026-10-06 21:30  
**适用版本**: Git commit 79b9a6d32 + 文档提交  
**预计完成时间**: 1-2天（所有待办项）
