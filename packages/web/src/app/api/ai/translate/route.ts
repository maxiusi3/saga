import { NextRequest, NextResponse } from 'next/server';
import { translateText } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const { text, targetLanguage } = await req.json();

  if (!text || !targetLanguage) {
    return NextResponse.json({ error: 'Missing text or targetLanguage' }, { status: 400 });
  }

  try {
    const translatedText = await translateText(text, targetLanguage);
    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Error translating text:', error);
    return NextResponse.json({ error: 'Failed to translate text' }, { status: 500 });
  }
}
