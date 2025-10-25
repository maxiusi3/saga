import { NextRequest, NextResponse } from 'next/server';
import { generateQuestions } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const { text, language } = await req.json();

  if (!text || !language) {
    return NextResponse.json({ error: 'Missing text or language' }, { status: 400 });
  }

  try {
    const questions = await generateQuestions(text, language);
    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}
