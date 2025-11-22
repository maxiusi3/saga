import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenRouter client
const openai = process.env.OPENROUTER_API_KEY ? new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000',
        'X-Title': 'Saga Family Biography Platform'
    }
}) : null

export async function POST(request: Request) {
    try {
        const { transcript, language = 'en' } = await request.json()

        // If no transcript (e.g. silence at start or STT failed), provide generic openers
        const effectiveTranscript = transcript || ""

        // Language-specific instructions
        const languageInstructions: Record<string, string> = {
            'zh-CN': '请用中文回复。',
            'zh-TW': '請用繁體中文回覆。',
            'en': 'Please respond in English.',
            'ja': '日本語で返信してください。',
            'ko': '한국어로 응답해주세요.',
            'es': 'Por favor responde en español.',
            'fr': 'Veuillez répondre en français.'
        }
        const langInstruction = languageInstructions[language] || languageInstructions['en']

        // 1. Try Real AI if available
        if (openai && effectiveTranscript.length > 5) {
            try {
                const completion = await openai.chat.completions.create({
                    model: 'openai/gpt-oss-20b:free', // Fast, free model
                    messages: [
                        {
                            role: 'system',
                            content: `You are an empathetic listener helping someone tell their life story. 
                            Your goal is to ask ONE short, encouraging follow-up question based on what they just said.
                            Keep it under 15 words. Be natural and curious.
                            ${langInstruction}`
                        },
                        { role: 'user', content: effectiveTranscript }
                    ],
                    temperature: 0.7,
                    max_tokens: 50
                })

                const aiPrompt = completion.choices[0]?.message?.content?.trim()
                if (aiPrompt) {
                    return NextResponse.json({
                        prompt: aiPrompt.replace(/^["']|["']$/g, ''), // Remove quotes if present
                        confidence: 0.9
                    })
                }
            } catch (error) {
                console.warn('OpenAI call failed, falling back to smart mock:', error)
            }
        }

        // 2. Smart Mock Fallback (Keyword based)
        const t = effectiveTranscript.toLowerCase()
        let prompts = [
            "And then what happened?",
            "How did that make you feel?",
            "Tell me more about that.",
            "What was going through your mind?",
            "Can you describe the scene?",
            "Who else was there?",
            "Why was that important to you?"
        ]

        if (language === 'zh-CN' || language === 'zh') {
            prompts = [
                "然后发生了什么？",
                "那让你感觉如何？",
                "能多说一点吗？",
                "当时你在想什么？",
                "能描述一下当时的场景吗？",
                "还有谁在那里？",
                "为什么这对你很重要？"
            ]

            if (t.includes('小时候') || t.includes('童年') || t.includes('孩子')) {
                prompts = ["那时候你最喜欢做什么？", "你还记得当时的朋友吗？", "那段时光给你留下了什么印象？"]
            } else if (t.includes('工作') || t.includes('上班') || t.includes('职业')) {
                prompts = ["第一天上班是什么感觉？", "同事们怎么样？", "那份工作教会了你什么？"]
            } else if (t.includes('家') || t.includes('父母') || t.includes('妈妈') || t.includes('爸爸')) {
                prompts = ["家里当时的气氛是怎样的？", "父母对你有什么影响？", "你们有什么家庭传统吗？"]
            }
        } else {
            // English keywords
            if (t.includes('child') || t.includes('young') || t.includes('school')) {
                prompts = ["What did you like to do back then?", "Do you remember your friends?", "What was your favorite memory from that time?"]
            } else if (t.includes('work') || t.includes('job') || t.includes('office')) {
                prompts = ["How was your first day?", "What were your colleagues like?", "What did you learn from that job?"]
            } else if (t.includes('family') || t.includes('mom') || t.includes('dad') || t.includes('parent')) {
                prompts = ["What was the atmosphere like at home?", "How did your parents influence you?", "Did you have any family traditions?"]
            }
        }

        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)]

        // Simulate network delay for realism if mocking
        if (!openai) await new Promise(resolve => setTimeout(resolve, 500))

        return NextResponse.json({
            prompt: randomPrompt,
            confidence: 0.8
        })

    } catch (error) {
        console.error('Real-time prompt generation error:', error)
        return NextResponse.json(
            { error: 'Failed to generate prompt' },
            { status: 500 }
        )
    }
}
