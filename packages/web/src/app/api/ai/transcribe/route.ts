import { NextRequest, NextResponse } from 'next/server';

// SiliconFlow Audio Transcription API endpoint
// Docs: https://docs.siliconflow.cn/cn/api-reference/audio/create-audio-transcriptions
const SILICONFLOW_ENDPOINT = 'https://api.siliconflow.cn/v1/audio/transcriptions';

/**
 * A simple retry wrapper with exponential backoff.
 * @param fn The async function to retry.
 * @param retries The number of retries.
 * @returns The result of the function.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    // Exponential backoff: 0.8s, 1.6s
    const delay = (3 - retries) * 800;
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1);
  }
}

/**
 * Safely parse JSON from a Response object.
 * @param res The Response object.
 * @returns The parsed JSON or the response text if parsing fails.
 */
async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    try {
      return await res.text();
    } catch {
      return '';
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const language = (formData.get('language') as string) || 'zh-CN';

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const apiKey = process.env.SILICONFLOW_API_KEY;
    const model = process.env.SILICONFLOW_MODEL || 'FunAudioLLM/SenseVoiceSmall';

    if (!apiKey) {
      console.error('SiliconFlow API key not configured.');
      return NextResponse.json(
        { error: 'Server configuration error: Missing SiliconFlow API key.' },
        { status: 500 }
      );
    }

    const outForm = new FormData();
    outForm.append('file', audioFile);
    outForm.append('model', model);
    outForm.append('language', language); // Supported by SenseVoice for better accuracy

    console.log(`Transcribing audio file of size ${audioFile.size} bytes using model ${model}`);

    const doRequest = async () => {
      const response = await fetch(SILICONFLOW_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: outForm,
      });

      if (!response.ok) {
        const errorBody = await safeJson(response);
        const { status } = response;
        console.error(`SiliconFlow API error: ${status}`, errorBody);
        if (status === 401) {
          throw new Error('Unauthorized: Invalid SiliconFlow API key.');
        }
        if (status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw new Error(`SiliconFlow API request failed with status ${status}`);
      }

      const data = await response.json();

      // Ensure compatibility with the expected response structure
      const text = data.text || '';
      const detectedLanguage = data.language || language;
      const confidence = typeof data.confidence === 'number' ? data.confidence : 0.9; // Default confidence

      return { text, confidence, language: detectedLanguage };
    };

    const result = await withRetry(doRequest, 2);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Transcription API error:', error.message);

    const message = error.message || 'An unknown error occurred.';
    let status = 500;

    if (message.includes('Unauthorized')) {
      status = 401;
    } else if (message.includes('Rate limit')) {
      status = 429;
    }

    return NextResponse.json(
      {
        error: 'Transcription failed. Please try again.',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
