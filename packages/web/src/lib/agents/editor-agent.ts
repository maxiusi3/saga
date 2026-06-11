import type { StoryElementType } from '@saga/shared/types/agents'

export interface EditorAgentInput {
  storyId: string
  projectId: string
  title?: string | null
  transcript: string
  createdAt: string
}

export interface EditorStoryElement {
  elementType: StoryElementType
  value: string
  normalizedValue?: string
  sourceQuote: string
  sourceStartOffset: number
  sourceEndOffset: number
  confidence: number
}

export interface EditorAgentOutput {
  standaloneStory: {
    title: string
    body: string
    summary: string
  }
  elements: EditorStoryElement[]
}

export function processStoryForBiography(input: EditorAgentInput): EditorAgentOutput {
  const cleanTranscript = input.transcript.trim()
  const title = input.title?.trim() || deriveTitle(cleanTranscript)
  const summary = cleanTranscript.length > 180 ? `${cleanTranscript.slice(0, 177)}...` : cleanTranscript

  return {
    standaloneStory: {
      title,
      body: cleanTranscript,
      summary,
    },
    elements: extractElements(cleanTranscript),
  }
}

function deriveTitle(transcript: string) {
  const firstSentence = transcript.split(/[.!?。！？]/)[0]?.trim()
  return firstSentence ? firstSentence.slice(0, 80) : 'Untitled Story'
}

function extractElements(transcript: string): EditorStoryElement[] {
  const elements: EditorStoryElement[] = []

  addRegexElements(elements, transcript, 'time', /\b(19\d{2}|20\d{2})\b/g, 0.9)
  addRegexElements(elements, transcript, 'place', /\b(Guangzhou|Shanghai|Beijing|Taipei|Hong Kong|New York|London)\b/g, 0.75)
  addRegexElements(
    elements,
    transcript,
    'person',
    /\b(my brother|my sister|my mother|my father|我的哥哥|我的姐姐|我的妈妈|我的爸爸)\b/gi,
    0.75,
  )
  addRegexElements(
    elements,
    transcript,
    'emotion',
    /\b(afraid|sad|happy|proud|guilty|scared|难过|开心|骄傲|内疚|害怕)\b/gi,
    0.75,
  )
  addRegexElements(elements, transcript, 'decision', /\b(I decided to [^.。]+|I chose to [^.。]+|我决定[^。]+)\b/gi, 0.78)
  addRegexElements(
    elements,
    transcript,
    'consequence',
    /\b(changed my life|taught me [^.。]+|让我[^。]+|改变了我的人生)\b/gi,
    0.78,
  )
  addRegexElements(elements, transcript, 'reflection', /\b(I learned [^.。]+|I realized [^.。]+|我明白了[^。]+)\b/gi, 0.8)

  if (transcript.length > 0) {
    elements.push({
      elementType: 'event',
      value: deriveTitle(transcript),
      sourceQuote: transcript.slice(0, Math.min(160, transcript.length)),
      sourceStartOffset: 0,
      sourceEndOffset: Math.min(160, transcript.length),
      confidence: 0.7,
    })
  }

  if (/family|mother|father|brother|sister|家|妈妈|爸爸|哥哥|姐姐/i.test(transcript)) {
    const quote = findSentence(transcript, /family|mother|father|brother|sister|家|妈妈|爸爸|哥哥|姐姐/i)
    elements.push({
      elementType: 'theme',
      value: 'Family',
      sourceQuote: quote.text,
      sourceStartOffset: quote.start,
      sourceEndOffset: quote.end,
      confidence: 0.72,
    })
  }

  return elements
}

function addRegexElements(
  elements: EditorStoryElement[],
  transcript: string,
  elementType: StoryElementType,
  pattern: RegExp,
  confidence: number,
) {
  for (const match of transcript.matchAll(pattern)) {
    const value = match[0]
    const start = match.index || 0

    elements.push({
      elementType,
      value,
      normalizedValue: value,
      sourceQuote: value,
      sourceStartOffset: start,
      sourceEndOffset: start + value.length,
      confidence,
    })
  }
}

function findSentence(transcript: string, pattern: RegExp) {
  const sentences = transcript.match(/[^.!?。！？]+[.!?。！？]?/g) || [transcript]
  let offset = 0

  for (const sentence of sentences) {
    if (pattern.test(sentence)) {
      return { text: sentence.trim(), start: offset, end: offset + sentence.length }
    }
    offset += sentence.length
  }

  return {
    text: transcript.slice(0, Math.min(160, transcript.length)),
    start: 0,
    end: Math.min(160, transcript.length),
  }
}
