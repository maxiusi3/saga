import { NextRequest, NextResponse } from 'next/server';
import { jsonWithRateLimit, requireAiRequest } from '@/lib/server/ai-guard';
import { InvalidAIResponseError, parseTranscriptionResponse } from '@/lib/ai-response';
import { audioMimeType, parseMediaReference } from '@/lib/media-reference';
import { requireMediaAccess, withMediaHeaders } from '@/lib/server/media-access';

// AUD-03 FIX: Accept either audio file OR storage path to bypass Vercel 4.5MB limit
const SILICONFLOW_ENDPOINT = 'https://api.siliconflow.cn/v1/audio/transcriptions';
const MAX_TRANSCRIBE_BYTES = 4 * 1024 * 1024; // 4MB to stay under Vercel's 4.5MB limit
const MAX_STORED_AUDIO_BYTES = 100 * 1024 * 1024;

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
    if (retries <= 0 || err instanceof InvalidAIResponseError) throw err;
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
  const guard = await requireAiRequest(request, 'transcribe');
  if (!guard.ok) return guard.response;

  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_TRANSCRIBE_BYTES) {
      return jsonWithRateLimit(
        { error: 'Audio file too large. Maximum size is 4MB for direct upload.' },
        guard.headers,
        413,
      );
    }

    let formData: FormData;
    try { formData = await request.formData(); } catch {
      return jsonWithRateLimit({ error: 'Invalid audio request' }, guard.headers, 400);
    }
    const audioFile = formData.get('audio');
    const storagePath = formData.get('storagePath');
    const storageBucket = formData.get('storageBucket') ?? 'audio-recordings';
    const language = (formData.get('language') as string) || 'zh-CN';
    if ((audioFile !== null && !(audioFile instanceof File)) ||
        (storagePath !== null && (typeof storagePath !== 'string' || !storagePath)) ||
        (audioFile !== null && storagePath !== null) ||
        (storagePath === null && formData.has('storageBucket'))) {
      return jsonWithRateLimit({ error: 'Invalid audio source' }, guard.headers, 400);
    }

    // AUD-03 FIX: Support both direct upload (small files) and storage path (large files)
    let audioBuffer: ArrayBuffer | null = null;
    let audioSize = 0;
    let filename = 'audio';
    let mimeType = 'application/octet-stream';

    if (storagePath) {
      const reference = parseMediaReference(storageBucket, storagePath);
      if (!reference) return jsonWithRateLimit({ error: 'Invalid media reference' }, guard.headers, 400);
      const access = await requireMediaAccess(reference, guard.user);
      if (!access.ok) return withMediaHeaders(access.response, guard.headers);
      try {
        const storage = access.admin.storage.from(reference.bucket);
        const { data: info, error: infoError } = await storage.info(reference.path);
        if (infoError || !info) {
          return jsonWithRateLimit({ error: 'Failed to fetch audio from storage' }, guard.headers, 404);
        }
        if (typeof info.size === 'number' && info.size > MAX_STORED_AUDIO_BYTES) {
          return jsonWithRateLimit({ error: 'Stored audio exceeds the 100MB limit' }, guard.headers, 413);
        }
        // The SDK's default download buffers the whole object as a Blob. Read a
        // stream so absent or stale size metadata cannot bypass the byte limit.
        const { data, error } = await storage.download(reference.path).asStream();

        if (error || !data) {
          return jsonWithRateLimit(
            { error: 'Failed to fetch audio from storage' },
            guard.headers,
            404
          );
        }

        filename = reference.path.split('/').pop()!;
        mimeType = audioMimeType(info.contentType ?? '', filename);
        const reader = data.getReader();
        const chunks: Uint8Array[] = [];
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            audioSize += value.byteLength;
            if (audioSize > MAX_STORED_AUDIO_BYTES) {
              await reader.cancel().catch(() => {});
              return jsonWithRateLimit({ error: 'Stored audio exceeds the 100MB limit' }, guard.headers, 413);
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        const buffer = new Uint8Array(audioSize);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.byteLength;
        }
        audioBuffer = buffer.buffer;
      } catch (err) {
        console.error('Error fetching from storage:', err);
        return jsonWithRateLimit(
          { error: 'Storage fetch error' },
          guard.headers,
          500
        );
      }
    } else if (audioFile) {
      // Direct upload
      if (audioFile.size > MAX_TRANSCRIBE_BYTES) {
        return jsonWithRateLimit(
          { error: `Audio file too large. Maximum size is ${MAX_TRANSCRIBE_BYTES / 1024 / 1024}MB for direct upload. Please upload to storage first.` },
          guard.headers,
          413,
        );
      }
      audioBuffer = await audioFile.arrayBuffer();
      audioSize = audioFile.size;
      filename = audioFile.name;
      mimeType = audioMimeType(audioFile.type, filename);
    } else {
      return jsonWithRateLimit(
        { error: 'No audio file or storage path provided' },
        guard.headers,
        400
      );
    }

    const apiKey = process.env.SILICONFLOW_API_KEY;
    const model = process.env.SILICONFLOW_MODEL || 'FunAudioLLM/SenseVoiceSmall';

    if (!apiKey) {
      console.error('SiliconFlow API key not configured.');
      return jsonWithRateLimit(
        { error: 'Server configuration error: Missing SiliconFlow API key.' },
        guard.headers,
        500
      );
    }

    // Type guard: audioBuffer must be non-null at this point
    if (!audioBuffer) {
      return jsonWithRateLimit(
        { error: 'Audio buffer is empty' },
        guard.headers,
        400
      );
    }

    const outForm = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    outForm.append('file', audioBlob, filename);
    outForm.append('model', model);
    outForm.append('language', language);

    console.log(`Transcribing audio of size ${audioSize} bytes using model ${model}`);

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
      const result = parseTranscriptionResponse(data);
      const detectedLanguage = data.language || language;
      return { ...result, language: detectedLanguage };
    };

    const result = await withRetry(doRequest, 2);

    return jsonWithRateLimit(result, guard.headers);

  } catch (error: any) {
    if (error instanceof InvalidAIResponseError) {
      return jsonWithRateLimit({ error: 'Invalid response from transcription service' }, guard.headers, 502);
    }
    console.error('Transcription API error:', error.message);

    const message = error.message || 'An unknown error occurred.';
    let status = 500;

    if (message.includes('Unauthorized')) {
      status = 401;
    } else if (message.includes('Rate limit')) {
      status = 429;
    }

    return jsonWithRateLimit(
      {
        error: 'Transcription failed. Please try again.',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      guard.headers,
      status
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  const origin = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
