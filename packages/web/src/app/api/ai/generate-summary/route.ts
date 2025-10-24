import { NextRequest, NextResponse } from 'next/server';
import { generateSummary } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const { text, language } = await req.json();

  if (!text || !language) {
    return NextResponse.json({ error: 'Missing text or language' }, { status: 400 });
  }

  try {
    const summary = await generateSummary(text, language);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
