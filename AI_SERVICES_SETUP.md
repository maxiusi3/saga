# AI 服务配置指南

Saga 项目使用两个 AI 服务提供商：

## 1. SiliconFlow - 语音转文字

**用途**: 将录音转换为文字（Speech-to-Text）

**获取 API Key**:
1. 访问 https://siliconflow.cn/
2. 注册/登录账号
3. 进入 API Keys 页面
4. 创建新的 API Key
5. 复制 API Key

**环境变量**:
```bash
SILICONFLOW_API_KEY=sk-xxxxxxxxxxxxxx
SILICONFLOW_MODEL=FunAudioLLM/SenseVoiceSmall
```

**模型说明**:
- `FunAudioLLM/SenseVoiceSmall`: 支持中文、英文等多语言，识别准确率高

## 2. OpenRouter - AI 内容生成

**用途**: 
- 生成故事标题
- 创建故事摘要
- 生成追问问题

**获取 API Key**:
1. 访问 https://openrouter.ai/
2. 注册/登录账号
3. 进入 Keys 页面
4. 创建新的 API Key
5. 充值一些额度（或使用免费模型）

**环境变量**:
```bash
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxx
```

**使用的模型**:
- `openai/gpt-oss-20b:free` - 免费的 20B 参数模型，适合文本生成任务

## Vercel 部署配置

### 步骤：

1. **登录 Vercel Dashboard**
   - 访问 https://vercel.com/

2. **进入项目设置**
   - 选择你的项目
   - 点击 Settings → Environment Variables

3. **添加环境变量**

   添加以下变量（Production 环境）：

   | Name | Value | Environment |
   |------|-------|-------------|
   | `SILICONFLOW_API_KEY` | 你的 SiliconFlow API Key | Production |
   | `SILICONFLOW_MODEL` | `FunAudioLLM/SenseVoiceSmall` | Production |
   | `OPENROUTER_API_KEY` | 你的 OpenRouter API Key | Production |
   | `NEXT_PUBLIC_WEB_URL` | `https://maxiusi.dpdns.org` | Production |

4. **重新部署**
   - 在 Deployments 页面
   - 点击最新部署右侧的 "..." 菜单
   - 选择 "Redeploy"
   - 或者推送新的代码触发自动部署

## 本地开发配置

创建 `.env.local` 文件：

```bash
# AI Services
SILICONFLOW_API_KEY=your-siliconflow-api-key
SILICONFLOW_MODEL=FunAudioLLM/SenseVoiceSmall
OPENROUTER_API_KEY=your-openrouter-api-key

# Web URL
NEXT_PUBLIC_WEB_URL=http://localhost:3000
```

## 测试配置

配置完成后，测试 AI 功能：

1. 访问录音页面
2. 录制一段音频
3. 点击"完成录制"
4. 检查是否成功生成：
   - 转录文本
   - 故事标题
   - 故事摘要
   - 追问问题

## 故障排查

### 语音转文字失败

**错误**: "Server configuration error: Missing SiliconFlow API key"

**解决**:
- 检查 `SILICONFLOW_API_KEY` 是否正确配置
- 确认 API Key 有效且有足够额度
- 检查 Vercel 环境变量是否已保存并重新部署

### AI 内容生成失败

**错误**: "AI content generation failed" (500 错误)

**解决**:
- 检查 `OPENROUTER_API_KEY` 是否正确配置
- 确认 OpenRouter 账户有足够额度
- 检查模型名称是否正确: `openai/gpt-oss-20b:free`
- 查看 Vercel 部署日志获取详细错误信息

### 查看日志

在 Vercel Dashboard:
1. 进入项目
2. 点击 "Logs" 或 "Functions"
3. 查看实时日志输出
4. 搜索 "AI" 或 "error" 关键词

## 成本估算

### SiliconFlow
- 按使用量计费
- 语音识别约 ¥0.01-0.05/分钟
- 建议充值 ¥50-100 用于测试

### OpenRouter
- 免费模型: `openai/gpt-oss-20b:free` - 完全免费
- 付费模型: 根据 token 使用量计费
- 建议先使用免费模型测试

## 安全建议

1. **不要提交 API Keys 到代码库**
2. **定期轮换 API Keys**
3. **设置使用限额**，避免意外超支
4. **监控 API 使用情况**
5. **使用环境变量**，不要硬编码在代码中

## 支持

如有问题，请查看：
- SiliconFlow 文档: https://docs.siliconflow.cn/
- OpenRouter 文档: https://openrouter.ai/docs
- Vercel 环境变量文档: https://vercel.com/docs/environment-variables
