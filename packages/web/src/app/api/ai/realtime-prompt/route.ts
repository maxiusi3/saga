import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { transcript, language = 'en' } = await request.json()

        // If no transcript (e.g. silence at start or STT failed), provide generic openers
        const effectiveTranscript = transcript || ""

        // Mock response for now to avoid external API dependency during initial implementation
        // In production, this would call OpenAI/Anthropic
        const prompts = [
            "And then what happened?",
            "How did that make you feel?",
            "Tell me more about that.",
            "What was going through your mind?",
            "Can you describe the scene?",
            "Who else was there?",
            "Why was that important to you?"
        ]

        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)]

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500))

        return NextResponse.json({
            prompt: randomPrompt,
            confidence: 0.9
        })

    } catch (error) {
        console.error('Real-time prompt generation error:', error)
        return NextResponse.json(
            { error: 'Failed to generate prompt' },
            { status: 500 }
        )
    }
}
