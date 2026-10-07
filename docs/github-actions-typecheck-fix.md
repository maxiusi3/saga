# GitHub Actions Type-Check 修复指南

**问题**: GitHub Actions CI 失败，但 Vercel 部署成功  
**原因**: `@saga/shared` 未构建，导致类型声明文件缺失  
**状态**: 🔴 需要手动推送（OAuth 权限限制）

---

## 🔍 根源分析

### 问题核心

1. **GitHub Actions 的执行顺序**:
   ```yaml
   - Install dependencies (npm ci)
   - Type check (npm run type-check --workspaces)  # ❌ 失败在这里
   ```

2. **Vercel 的执行顺序**:
   ```json
   "buildCommand": "npm run build:vercel"
   // 展开为: npm run build --workspace=packages/shared && npm run build --workspace=packages/web
   ```

3. **关键差异**:
   - GitHub Actions: 并行 type-check 所有 workspace，**未先构建 shared**
   - Vercel: 先构建 shared，再构建 web，**类型声明文件存在**

---

## 📊 技术细节

### `@saga/shared` 包结构

```
packages/shared/
├── src/           # 源码
│   └── index.ts
├── dist/          # ❌ 在 CI 中不存在（需要先构建）
│   ├── index.js
│   └── index.d.ts  # TypeScript 需要这个类型声明文件
└── package.json
    "main": "dist/index.js",
    "types": "dist/index.d.ts"  # 👈 TypeScript 查找类型声明的位置
```

### `@saga/web` 的依赖

```json
// packages/web/package.json
{
  "dependencies": {
    "@saga/shared": "file:../shared"
  }
}
```

```json
// packages/web/tsconfig.json
{
  "paths": {
    "@saga/shared/*": ["../shared/src/*"]  # 开发时直接引用源码
  }
}
```

### 为什么 type-check 会失败

虽然 `tsconfig.json` 有路径别名指向 `src/`，但 TypeScript 在解析 `@saga/shared` 包本身时，仍然会：

1. 查找 `node_modules/@saga/shared` (symlink 到 `packages/shared`)
2. 读取 `packages/shared/package.json` 的 `"types": "dist/index.d.ts"`
3. 尝试加载 `packages/shared/dist/index.d.ts` ❌ **文件不存在**

**结果**: 20+ 个文件报错 "Cannot find module '@saga/shared'"

---

## ✅ 解决方案

### 修改 `.github/workflows/deploy.yml`

在 **line 42** （`Install dependencies` 之后）添加：

```yaml
      - name: Install dependencies
        run: npm ci

      - name: Build shared package
        run: npm run build --workspace=packages/shared

      - name: Validate deployment configuration
        run: npm run test:infra
```

### 完整的修改 diff

```diff
diff --git a/.github/workflows/deploy.yml b/.github/workflows/deploy.yml
index 62fce6f71..7e05e110f 100644
--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ -39,6 +39,9 @@ jobs:
       - name: Install dependencies
         run: npm ci
 
+      - name: Build shared package
+        run: npm run build --workspace=packages/shared
+
       - name: Validate deployment configuration
         run: npm run test:infra
```

---

## 🚀 执行步骤

### 方案 A: 手动推送修改（推荐）

由于 Claude Code 的 OAuth token 缺少 `workflow` scope，你需要手动推送：

```bash
cd /Users/eat/Documents/eatpotato/saga传奇

# 检查当前提交
git log --oneline -1
# 应该显示: 88aa474f6 修复 GitHub Actions type-check 失败：先构建 shared package

# 推送到 GitHub（使用你的 Git 凭证）
git push origin main
```

**如果推送失败**（同样的权限错误），执行方案 B。

---

### 方案 B: 直接在 GitHub 网页编辑

1. **打开 GitHub workflow 文件**:
   https://github.com/maxiusi3/saga/blob/main/.github/workflows/deploy.yml

2. **点击编辑按钮**（铅笔图标）

3. **在 line 42 之后添加以下内容**:
   ```yaml
         - name: Build shared package
           run: npm run build --workspace=packages/shared
   
   ```
   
   **重要**: 保持缩进一致（8 个空格）

4. **提交更改**:
   - Commit message: `Fix type-check: Build shared package first`
   - Description: 
     ```
     Add build step for @saga/shared before type-check to ensure
     type declaration files exist in CI environment.
     
     Matches Vercel build sequence (build shared → build web).
     ```

5. **点击 "Commit changes"**

---

## 🧪 验证修复

### 1. 检查 GitHub Actions 运行

推送后，访问: https://github.com/maxiusi3/saga/actions

**预期结果**:
- ✅ CI job 通过
- ✅ Type check 步骤成功
- ✅ 所有测试通过

### 2. 查看构建日志

在 "Type check" 步骤的日志中，应该看到：
```
Run npm run type-check
> saga-family-biography@1.0.0 type-check
> npm run type-check --workspaces

> @saga/shared@1.5.0 type-check
> tsc --noEmit
✅ No errors

> @saga/web@1.0.0 type-check
> tsc --noEmit
✅ No errors
```

### 3. 确认构建时间增加

**之前**: ~2 分钟  
**之后**: ~2 分 15 秒（增加约 15 秒，用于构建 @saga/shared）

这是正常的，也是必要的代价。

---

## 📈 影响分析

### ✅ 优点

1. **类型安全保障**: `@saga/shared` 的类型错误会被检测
2. **一致性**: CI 和 Vercel 构建流程一致
3. **可维护性**: 未来添加更多 workspace 时，模式清晰
4. **避免静默失败**: 类型错误在 CI 阶段就会被发现

### ⚠️ 成本

1. **CI 时间**: 增加 10-20 秒（构建 @saga/shared）
2. **无其他负面影响**

---

## 🔄 替代方案（不推荐）

### 方案 2: 修改 type-check 脚本，跳过 shared

```json
// package.json
{
  "scripts": {
    "type-check": "npm run type-check --workspace=packages/web"
  }
}
```

**为什么不推荐**:
- ❌ `@saga/shared` 的类型错误不会被检测
- ❌ 类型安全风险
- ❌ 不符合标准实践

---

## 📚 学到的经验

### Monorepo 类型检查的最佳实践

1. **依赖顺序很重要**: 
   - 被依赖的包（shared）必须先构建
   - 依赖方（web）才能正确进行类型检查

2. **CI 应该模拟生产构建**:
   - 不要在 CI 中使用"快捷方式"
   - 与生产构建流程保持一致

3. **路径别名不是万能的**:
   - `tsconfig.json` 的路径别名只是开发时的便利
   - TypeScript 仍然会查找包的类型声明文件

### 为什么 Vercel 没问题？

Vercel 的 `vercel.json` 明确指定了正确的构建顺序：

```json
{
  "buildCommand": "cd ../.. && npm run build:vercel"
}
```

而 `build:vercel` 脚本正确地先构建 shared：

```json
{
  "build:vercel": "npm run build --workspace=packages/shared && npm run build --workspace=packages/web"
}
```

---

## ✅ 完成清单

- [x] 理解根源（`@saga/shared` 未构建）
- [x] 本地提交修复（commit 88aa474f6）
- [ ] 推送到 GitHub（方案 A 或 方案 B）
- [ ] 验证 GitHub Actions 通过
- [ ] 更新部署文档

---

## 🆘 故障排除

### 如果推送仍然失败

**错误信息**: `refusing to allow an OAuth App to create or update workflow`

**原因**: Git 凭证缺少 `workflow` scope

**解决**:
1. 使用方案 B（GitHub 网页编辑）
2. 或者，更新 Git 凭证：
   - GitHub Settings → Developer settings → Personal access tokens
   - 创建新 token，勾选 `workflow` scope
   - 更新本地 Git 凭证

### 如果 type-check 仍然失败

1. **检查构建步骤是否执行**:
   - 查看 GitHub Actions 日志
   - 确认 "Build shared package" 步骤存在且成功

2. **检查 dist/ 目录**:
   ```bash
   # 在 "Build shared package" 步骤后添加调试
   - name: Debug - List shared dist
     run: ls -la packages/shared/dist/
   ```

3. **本地测试**:
   ```bash
   cd /Users/eat/Documents/eatpotato/saga传奇
   npm ci
   npm run build --workspace=packages/shared
   npm run type-check
   # 应该全部通过
   ```

---

**文档生成时间**: 2026-10-07 22:30  
**Git Commit**: 88aa474f6  
**待推送**: ⏳ 等待手动推送
