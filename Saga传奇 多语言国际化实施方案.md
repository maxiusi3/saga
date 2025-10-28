# Saga传奇 多语言国际化实施方案

## 背景与目标

**现状分析**：
- 项目：Next.js 15 + React 19 + TypeScript + Supabase
- 已预留 8 种语言目录结构（`public/locales/`），但翻译文件为空
- 未安装任何 i18n 框架
- 约 520+ 条硬编码文本（英文 380 条 + 中文 140 条）
- AI 功能包括 STT 和内容生成，需语言对齐

**目标**：
1. 实现 8 种语言完整支持：英语（默认）、法语、西班牙语、葡萄牙语、日语、韩文、繁体中文、简体中文
2. 用户可通过界面切换语言，偏好持久化
3. AI 输出（标题、摘要、问题）与用户选择语言对齐
4. STT 转录服务根据用户语言自动选择识别语言

---

## 任务分解

### 任务 1：搭建国际化基础设施

**目标**：安装 i18n 框架，配置路由和中间件

**具体操作**：
1. 安装依赖：
   - `next-intl` (推荐用于 Next.js App Router)
   - `@formatjs/intl-localematcher`
   - `negotiator`

2. 创建配置文件：
   - `packages/web/src/i18n/config.ts` - 语言列表和默认语言配置
   - `packages/web/src/i18n/request.ts` - next-intl 请求配置

3. 更新 `packages/web/middleware.ts`：
   - 集成 next-intl 中间件
   - 添加语言检测逻辑（浏览器偏好 → Cookie → 默认英语）
   - 配置 matcher 匹配多语言路由

4. 修改 `packages/web/app/layout.tsx`：
   - 添加语言参数支持
   - 包装 NextIntlClientProvider
   - 传递服务端加载的翻译消息

**依赖**：无

**验收标准**：
- 访问 `/` 自动重定向到 `/en/`
- 访问 `/zh-CN/` 正确加载中文路由
- 浏览器语言偏好自动检测生效

---

### 任务 2：创建翻译文件结构和初始内容

**目标**：提取硬编码文本，生成 JSON 翻译文件

**文件结构**：
```
public/locales/
├── en/
│   ├── common.json          # 通用文本（导航、按钮、状态）
│   ├── pages.json           # 页面专用文本（首页、仪表板等）
│   ├── auth.json            # 认证相关
│   ├── projects.json        # 项目管理
│   ├── recording.json       # 录音界面
│   ├── errors.json          # 错误和验证消息
│   └── ai.json              # AI 提示词和消息
├── zh-CN/
│   └── (同上结构)
├── zh-TW/
│   └── (同上结构)
└── (其他 5 种语言同上)
```

**具体操作**：

1. **提取主要页面文本**：
   - `packages/web/src/app/page.tsx` → `pages.json#home`
   - `packages/web/src/app/auth/signin/page.tsx` → `auth.json`
   - `packages/web/src/app/dashboard/page.tsx` → `pages.json#dashboard`
   - `packages/web/src/app/dashboard/projects/[id]/record/page.tsx` → `recording.json`

2. **提取组件文本**：
   - `packages/web/src/components/export/data-export-dialog.tsx` → `projects.json#export`
   - `packages/web/src/components/audio/WebSpeechRecorder.tsx` → `recording.json#webSpeech`
   - `packages/web/src/components/subscription/*` → `projects.json#subscription`

3. **提取 API 错误消息**：
   - `packages/web/src/app/api/*/route.ts` 中所有错误消息 → `errors.json#api`

4. **提取 AI 相关文本**：
   - `packages/web/src/app/api/ai/generate-content/route.ts:36-51` 系统提示词 → `ai.json#systemPrompt`
   - `packages/web/src/app/api/ai/generate-content/route.ts:54-59` 用户提示词模板 → `ai.json#userPromptTemplate`
   - `packages/web/src/lib/ai-service.ts:209-279` Mock 示例 → `ai.json#examples`

5. **初始翻译**：
   - 优先完成 `en` 和 `zh-CN`
   - 使用 AI 辅助生成其他 6 种语言的初翻
   - 标记需人工审核的关键文案

**翻译规范**：
- 键名使用 camelCase（如 `startRecording`）
- 动态变量使用 `{variable}` 格式
- 复数形式使用 ICU 语法
- AI 提示词保持英文，仅翻译用户可见部分

**依赖**：任务 1

**验收标准**：
- 所有 8 种语言的翻译文件完整
- `en` 和 `zh-CN` 翻译质量达到生产标准
- 其他语言标记为"待审核"

---

### 任务 3：重构页面和组件使用翻译

**目标**：替换所有硬编码文本为翻译键

**优先级排序**（按影响范围）：

**高优先级**（用户必见）：
1. `packages/web/src/app/page.tsx` - 首页
2. `packages/web/src/app/auth/signin/page.tsx` - 登录页
3. `packages/web/src/app/dashboard/page.tsx` - 仪表板
4. `packages/web/src/app/dashboard/projects/[id]/record/page.tsx` - 录音界面
5. `packages/web/src/components/recording/recording-interface.tsx` - 录音组件

**中优先级**（高频功能）：
1. `packages/web/src/app/dashboard/projects/*` - 项目管理页面
2. `packages/web/src/components/export/data-export-dialog.tsx` - 数据导出
3. `packages/web/src/components/subscription/*` - 订阅组件
4. `packages/web/src/components/audio/*` - 音频组件

**低优先级**（边缘功能）：
1. 帮助中心、条款页面
2. 错误页面（404、500）
3. 营销长文案

**重构模式**：

```typescript
// 客户端组件
'use client'
import { useTranslations } from 'next-intl'

export default function Component() {
  const t = useTranslations('common')
  return <button>{t('actions.start')}</button>
}

// 服务端组件
import { getTranslations } from 'next-intl/server'

export default async function Page() {
  const t = await getTranslations('pages.home')
  return <h1>{t('hero.title')}</h1>
}
```

**关键文件修改清单**：
- `packages/web/src/app/page.tsx:120-503` - 首页所有文案
- `packages/web/src/components/export/data-export-dialog.tsx:140-299` - 中文文案替换
- `packages/web/src/components/audio/WebSpeechRecorder.tsx:190-439` - 中文消息替换
- `packages/web/src/services/subscription.service.ts:196-259` - 状态文本提取

**依赖**：任务 2

**验收标准**：
- 所有页面无硬编码文本
- 切换语言后界面完全翻译
- 无翻译键缺失错误

---

### 任务 4：添加语言切换器组件

**目标**：用户可随时切换语言，偏好持久化

**实现位置**：
- 顶部导航栏：`packages/web/src/components/layout/Header.tsx`（新建或修改）
- 用户设置页面：`packages/web/src/app/dashboard/settings/page.tsx`

**组件功能**：
1. 显示当前语言（国旗图标 + 语言名称）
2. 下拉菜单列出 8 种语言
3. 点击切换后：
   - 更新 URL（如 `/en/dashboard` → `/zh-CN/dashboard`）
   - 保存偏好到 Cookie
   - 同步到 Supabase user_settings 表的 `language` 字段
4. 无需刷新页面（使用 `useRouter` + `usePathname`）

**数据持久化**：
- 前端：Cookie（`NEXT_LOCALE`，7天有效期）
- 后端：`packages/backend/src/models/user-settings.ts:26-27` 已有 `language` 字段
- API：`packages/backend/src/routes/settings.ts` 已有 `/api/settings/language` 端点

**依赖**：任务 3

**验收标准**：
- 语言切换器在所有页面可见
- 切换后 URL 和界面立即更新
- 刷新页面后语言保持不变
- 已登录用户的语言偏好同步到数据库

---

### 任务 5：AI 服务多语言适配

**目标**：AI 转录和内容生成根据用户语言动态调整

**关键文件**：
- `packages/web/src/lib/ai-service.ts`
- `packages/web/src/app/api/ai/transcribe/route.ts`
- `packages/web/src/app/api/ai/generate-content/route.ts`

**具体改动**：

#### 5.1 STT 语音转录多语言

**文件**：`packages/web/src/app/api/ai/transcribe/route.ts:1-139`

**当前逻辑**：
```typescript
// 当前默认使用 zh-CN
language: formData.get('language') as string || 'zh-CN'
```

**修改方案**：
1. 从请求读取用户语言偏好（Cookie 或请求参数）
2. 映射语言代码到 STT 引擎支持的格式：
   - `en` → `en-US`
   - `zh-CN` → `zh-CN`
   - `zh-TW` → `zh-TW`
   - `ja` → `ja-JP`
   - `ko` → `ko-KR`
   - `es` → `es-ES`
   - `fr` → `fr-FR`
   - `pt` → `pt-BR`
3. 传递正确的 `language` 参数给 SiliconFlow API

#### 5.2 AI 内容生成多语言

**文件**：`packages/web/src/app/api/ai/generate-content/route.ts:14-162`

**当前逻辑**：
- 系统提示词固定英文
- 生成内容（标题、摘要、问题）默认英文

**修改方案**：

1. **系统提示词保持英文**（AI 模型对英文指令理解最佳）

2. **用户提示词添加语言指令**：
   ```typescript
   const languageInstruction = {
     'en': 'Generate all content in English.',
     'zh-CN': 'Generate all content in Simplified Chinese (简体中文).',
     'zh-TW': 'Generate all content in Traditional Chinese (繁體中文).',
     'ja': 'Generate all content in Japanese (日本語).',
     'ko': 'Generate all content in Korean (한국어).',
     'es': 'Generate all content in Spanish (Español).',
     'fr': 'Generate all content in French (Français).',
     'pt': 'Generate all content in Portuguese (Português).'
   }
   
   const userPrompt = `${languageInstruction[userLanguage]}
   
   Please analyze this personal story and generate appropriate content:
   ${prompt ? `Story context/prompt: ${prompt}\n\n` : ''}
   Story transcript: "${transcript}"
   
   Generate a title, summary, and follow-up questions...`
   ```

3. **验证生成内容语言**：
   - 添加简单的语言检测（如检测字符集）
   - 如果语言不匹配，记录警告并重试

**文件**：`packages/web/src/lib/ai-service.ts:209-279`

**修改 Mock 数据**：
- 为每种语言创建独立的 Mock 示例
- 根据用户语言返回对应语言的 Mock 数据

**依赖**：任务 4（需要获取用户语言偏好）

**验收标准**：
- STT 转录准确识别用户选择的语言
- AI 生成的标题、摘要、问题与用户语言一致
- 切换语言后新录音自动使用新语言

---

### 任务 6：日期、时间和数字格式化

**目标**：根据语言区域正确格式化显示

**实现方案**：

使用 `next-intl` 的内置格式化工具：

```typescript
import { useFormatter } from 'next-intl'

const format = useFormatter()

// 日期
format.dateTime(new Date(), {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

// 相对时间
format.relativeTime(new Date(pastDate))

// 数字
format.number(1234567.89, {
  style: 'currency',
  currency: 'USD'
})
```

**应用位置**：
- 故事列表的时间戳
- 项目创建日期
- 订阅到期日期
- 数据导出文件大小

**依赖**：任务 3

**验收标准**：
- 英文显示："January 15, 2025"
- 中文显示："2025年1月15日"
- 时区根据用户设置自动调整

---

### 任务 7：SEO 和元数据国际化

**目标**：每种语言有独立的 SEO 元数据

**实现位置**：
- `packages/web/src/app/[locale]/layout.tsx`（新建或修改）
- `packages/web/src/app/[locale]/page.tsx`

**元数据配置**：
```typescript
export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'metadata' })
  
  return {
    title: t('home.title'),
    description: t('home.description'),
    openGraph: {
      title: t('home.ogTitle'),
      description: t('home.ogDescription'),
      locale: locale,
      alternateLocale: ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'pt']
    },
    twitter: {
      title: t('home.twitterTitle'),
      description: t('home.twitterDescription')
    }
  }
}
```

**hreflang 标签**：
在 `<head>` 中添加：
```html
<link rel="alternate" hreflang="en" href="https://saga.com/en" />
<link rel="alternate" hreflang="zh-CN" href="https://saga.com/zh-CN" />
<!-- 其他语言 -->
<link rel="alternate" hreflang="x-default" href="https://saga.com/en" />
```

**依赖**：任务 2

**验收标准**：
- 每种语言页面有独立 meta 标签
- Google Search Console 识别所有语言版本
- 社交分享卡片显示正确语言

---

### 任务 8：测试和质量保证

**测试范围**：

#### 8.1 功能测试
- [ ] 语言切换无需刷新
- [ ] URL 路径包含正确语言代码
- [ ] 浏览器语言自动检测
- [ ] Cookie 语言偏好保存和读取
- [ ] 数据库语言设置同步

#### 8.2 翻译质量测试
- [ ] 所有页面无"翻译缺失"占位符
- [ ] 动态内容（如错误消息）正确翻译
- [ ] 复数形式正确处理（如 "1 story" vs "2 stories"）
- [ ] 长文本不会溢出 UI

#### 8.3 AI 功能测试
- [ ] STT 正确识别每种语言（录制测试音频）
- [ ] AI 生成内容语言与用户选择一致
- [ ] 错误消息正确翻译

#### 8.4 性能测试
- [ ] 翻译文件加载不阻塞首屏渲染
- [ ] 切换语言响应时间 < 200ms
- [ ] 构建产物大小增量 < 500KB

#### 8.5 跨浏览器测试
- [ ] Chrome、Safari、Firefox、Edge
- [ ] iOS Safari、Android Chrome
- [ ] 桌面和移动设备响应式

**依赖**：任务 1-7

**验收标准**：
- 所有测试用例通过
- 无阻断性 bug
- 翻译质量达到生产标准

---

## 关键约束和注意事项

### 技术约束
1. **AI 提示词语言策略**：
   - ✅ 系统提示词保持英文（OpenAI 模型对英文理解最佳）
   - ✅ 用户提示词中添加目标语言指令
   - ⚠️ 非英文提示可能略降低 AI 性能，需监控质量

2. **STT 引擎语言支持**：
   - 确认 SiliconFlow API 支持所有 8 种语言
   - 如不支持，需准备备用方案（Google Cloud Speech）

3. **URL 结构变化**：
   - 从 `/dashboard` 变为 `/en/dashboard`
   - 需配置 301 重定向避免 SEO 损失
   - 更新所有内部链接

### 业务约束
1. **翻译质量**：
   - 第一阶段仅 `en` 和 `zh-CN` 需达到生产质量
   - 其他 6 种语言可用 AI 初翻 + 标记"Beta"
   - 后续根据用户反馈迭代

2. **用户数据**：
   - 用户已录制的故事内容不翻译（保持原文）
   - 仅界面和 AI 生成内容翻译

3. **成本控制**：
   - 专业翻译服务成本高，优先使用 AI 辅助
   - 关键页面（首页、登录、录音）人工审核

### 性能约束
1. **翻译文件大小**：
   - 单个语言包 < 100KB
   - 使用代码分割，按页面懒加载

2. **缓存策略**：
   - 翻译文件设置长期缓存（1年）
   - 使用版本号或哈希避免缓存失效

---

## 实施时间线

| 阶段 | 任务 | 预计时长 |
|-----|------|---------|
| **第1周** | 任务 1 + 任务 2（en/zh-CN） | 3-4 天 |
| **第2周** | 任务 3（高优先级页面） | 4-5 天 |
| **第3周** | 任务 3（中/低优先级） + 任务 4 | 4-5 天 |
| **第4周** | 任务 5 + 任务 6 + 任务 7 | 4-5 天 |
| **第5周** | 任务 2（其他6种语言） + 任务 8 | 3-5 天 |
| **总计** | | **18-24 天** |

---

## 风险与缓解措施

| 风险 | 影响 | 概率 | 缓解措施 |
|-----|------|------|---------|
| AI 非英文提示性能下降 | 中 | 中 | 监控生成质量，必要时回退英文提示 + 后翻译 |
| STT 不支持某些语言 | 高 | 低 | 预先测试，准备 Google Cloud Speech 备用 |
| 翻译质量差引发用户投诉 | 中 | 中 | 关键页面人工审核，标记其他语言为 Beta |
| URL 变化影响 SEO 排名 | 中 | 中 | 配置 301 重定向，添加 hreflang 标签 |
| 构建产物过大影响性能 | 低 | 低 | 代码分割 + 懒加载 + CDN 加速 |

---

## 成功指标

### 技术指标
- ✅ 所有 8 种语言路由正常工作
- ✅ 翻译覆盖率 > 95%
- ✅ 页面加载时间增量 < 500ms
- ✅ 无 i18n 相关运行时错误

### 业务指标
- ✅ 非英语用户访问增长（监控 GA 数据）
- ✅ 语言切换使用率 > 5%
- ✅ AI 内容语言准确率 > 90%
- ✅ 用户语言偏好留存率 > 80%

---

## 附录：关键文件清单

### 新建文件
- `packages/web/src/i18n/config.ts` - i18n 配置
- `packages/web/src/i18n/request.ts` - next-intl 请求配置
- `packages/web/src/components/layout/LanguageSwitcher.tsx` - 语言切换器
- `public/locales/{locale}/*.json` - 翻译文件（8种语言 × 7个文件）

### 修改文件
- `packages/web/middleware.ts` - 添加语言检测
- `packages/web/app/layout.tsx` - 集成 NextIntlClientProvider
- `packages/web/next.config.js` - 添加 i18n 配置（可选）
- `packages/web/src/app/page.tsx` - 首页重构
- `packages/web/src/app/api/ai/transcribe/route.ts` - STT 多语言
- `packages/web/src/app/api/ai/generate-content/route.ts` - AI 内容生成多语言
- `packages/web/src/lib/ai-service.ts` - AI 服务适配
- 所有含硬编码文本的组件和页面（约 40+ 个文件）

### 后端无需修改
- 后端 API 已支持 `language` 字段存储和查询
- `/api/settings/language` 端点现成可用

---

## 下一步行动

**立即可开始**（无需额外确认）：
1. 安装 `next-intl` 及相关依赖
2. 创建 i18n 配置文件
3. 提取首页文本到 `en/pages.json`

**需用户确认后再执行**：
1. AI 提示词翻译策略最终决策
2. 第一阶段是否仅做 en + zh-CN（其他6种语言后续迭代）
3. URL 结构是否采用 `/[locale]/path` 模式
4. 翻译质量标准和审核流程

---

**计划制定完成，等待用户批准后实施。**