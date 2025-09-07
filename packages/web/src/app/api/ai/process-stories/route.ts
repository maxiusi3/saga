import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenRouter client with DeepSeek
const openai = process.env.OPENROUTER_API_KEY ? new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000',
    'X-Title': 'Saga Family Biography Platform'
  }
}) : null

export async function POST(request: NextRequest) {
  try {
    // Check if OpenRouter API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { 
      stories, 
      action, 
      language = 'zh-CN',
      projectTitle,
      storytellerName 
    } = body

    if (!stories || !Array.isArray(stories) || stories.length === 0) {
      return NextResponse.json(
        { error: 'No stories provided' },
        { status: 400 }
      )
    }

    if (!action) {
      return NextResponse.json(
        { error: 'No action specified' },
        { status: 400 }
      )
    }

    let systemPrompt = ''
    let userPrompt = ''

    switch (action) {
      case 'generate_chapter':
        systemPrompt = `你是一位专业的家族传记编辑，擅长将多个相关故事整理成有条理的章节。

你的任务是：
1. 分析提供的故事内容，找出共同主题和时间线
2. 为这些故事创建一个有意义的章节标题
3. 写一个章节介绍，概括这些故事的共同主题
4. 提供一个章节总结，突出关键信息和情感价值
5. 建议相关的后续问题，帮助挖掘更多相关记忆

请以JSON格式返回结果，包含以下字段：
- title: 章节标题
- introduction: 章节介绍（100-200字）
- summary: 章节总结（150-300字）
- themes: 主要主题列表（3-5个）
- timeline: 时间线信息
- followUpQuestions: 后续问题建议（3-5个）
- confidence: 处理质量评分（0.7-1.0）`

        const storiesText = stories.map((story: any, index: number) => 
          `故事 ${index + 1}: ${story.title || '无标题'}\n内容: ${story.content || story.transcript || ''}\n时间: ${story.createdAt || '未知'}\n`
        ).join('\n---\n')

        userPrompt = `项目: ${projectTitle || '家族传记'}
讲述者: ${storytellerName || '家族成员'}

以下是需要整理成章节的故事：

${storiesText}

请分析这些故事，创建一个有意义的章节。`
        break

      case 'generate_summary':
        systemPrompt = `你是一位专业的家族传记编辑，擅长为整个项目创建精彩的总结。

你的任务是：
1. 分析所有提供的故事
2. 识别主要主题和人生阶段
3. 创建一个引人入胜的项目总结
4. 突出最重要的人生经历和智慧
5. 提供情感共鸣的结语

请以JSON格式返回结果，包含以下字段：
- title: 总结标题
- overview: 项目概述（200-300字）
- keyThemes: 主要主题（5-8个）
- lifeStages: 人生阶段总结
- wisdom: 人生智慧和教训
- legacy: 传承价值
- confidence: 处理质量评分（0.7-1.0）`

        const allStoriesText = stories.map((story: any, index: number) => 
          `${story.title || `故事 ${index + 1}`}: ${story.content || story.transcript || ''}`
        ).join('\n\n')

        userPrompt = `项目: ${projectTitle || '家族传记'}
讲述者: ${storytellerName || '家族成员'}

以下是所有的故事内容：

${allStoriesText}

请为这个家族传记项目创建一个全面的总结。`
        break

      case 'suggest_questions':
        systemPrompt = `你是一位专业的家族史采访专家，擅长根据已有故事提出深入的后续问题。

你的任务是：
1. 分析已有的故事内容
2. 识别可以深入探索的主题
3. 提出能够引发更多回忆的问题
4. 确保问题具有情感深度和个人意义

请以JSON格式返回结果，包含以下字段：
- categories: 问题分类（如童年、工作、家庭等）
- questions: 具体问题列表，每个问题包含category和question字段
- themes: 建议探索的主题
- confidence: 建议质量评分（0.7-1.0）`

        const storiesForQuestions = stories.map((story: any) => 
          `${story.title || '故事'}: ${story.content || story.transcript || ''}`
        ).join('\n\n')

        userPrompt = `基于以下已有的故事内容，请提出20-30个深入的后续问题：

${storiesForQuestions}

请确保问题能够帮助挖掘更多有意义的家族记忆。`
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        )
    }

    // Call DeepSeek via OpenRouter
    if (!openai) {
      throw new Error('OpenRouter client not initialized')
    }

    console.log(`Processing ${action} for ${stories.length} stories`)

    const completion = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat-v3.1:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from DeepSeek')
    }

    console.log('DeepSeek response received')

    // Parse and validate the response
    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse DeepSeek response:', parseError)
      throw new Error('Invalid response format from AI service')
    }

    // Add metadata
    result.processedAt = new Date().toISOString()
    result.action = action
    result.storiesCount = stories.length
    result.model = 'deepseek/deepseek-chat-v3.1:free'

    return NextResponse.json(result)

  } catch (error) {
    console.error('Story processing error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process stories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: 'Story processing API is running',
    supportedActions: [
      'generate_chapter',
      'generate_summary', 
      'suggest_questions'
    ],
    model: 'deepseek/deepseek-chat-v3.1:free'
  })
}
