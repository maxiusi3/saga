import { NextRequest, NextResponse } from 'next/server';
import { generateTitle } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const { text, language } = await req.json();

  if (!text || !language) {
    return NextResponse.json({ error: 'Missing text or language' }, { status: 400 });
  }

  try {
    const title = await generateTitle(text, language);
    return NextResponse.json({ title });
  } catch (error) {
    console.error('Error generating title:', error);
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 });
  }
}
