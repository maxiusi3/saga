import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateTitle(text: string, language: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant. Generate a concise and engaging title for the following text, in ${language}.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens: 20,
  });
  return response.choices[0].message.content?.trim() || 'AI Generated Title';
}

export async function generateSummary(text: string, language: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant. Generate a concise summary of the following text, in ${language}.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens: 100,
  });
  return response.choices[0].message.content?.trim() || 'AI Generated Summary';
}

export async function generateQuestions(text: string, language: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant. Generate a list of 3-5 follow-up questions for the following text, in ${language}. Return the questions as a JSON array of strings.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens: 150,
    response_format: { type: 'json_object' },
  });
  const result = response.choices[0].message.content;
  if (result) {
    try {
      const parsed = JSON.parse(result);
      return parsed.questions || [];
    } catch (error) {
      console.error('Error parsing questions from AI response:', error);
      return [];
    }
  }
  return [];
}

export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant. Translate the following text to ${targetLanguage}.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens: 1024,
  });
  return response.choices[0].message.content?.trim() || `Translated text to ${targetLanguage}`;
}
