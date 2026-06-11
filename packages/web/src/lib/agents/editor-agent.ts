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
  const trimmedTranscript = trimTranscriptWithSourceOffset(input.transcript)
  const cleanTranscript = trimmedTranscript.text
  const title = input.title?.trim() || deriveTitle(cleanTranscript)
  const summary = cleanTranscript.length > 180 ? `${cleanTranscript.slice(0, 177)}...` : cleanTranscript

  return {
    standaloneStory: {
      title,
      body: cleanTranscript,
      summary,
    },
    elements: extractElements(cleanTranscript, trimmedTranscript.sourceStartOffset),
  }
}

function trimTranscriptWithSourceOffset(transcript: string) {
  const firstContentOffset = transcript.search(/\S/)
  if (firstContentOffset === -1) {
    return { text: '', sourceStartOffset: 0 }
  }

  return {
    text: transcript.trim(),
    sourceStartOffset: firstContentOffset,
  }
}

function deriveTitle(transcript: string) {
  const firstSentence = transcript.split(/[.!?。！？]/)[0]?.trim()
  return firstSentence ? firstSentence.slice(0, 80) : 'Untitled Story'
}

function extractElements(transcript: string, sourceOffset: number): EditorStoryElement[] {
  const elements: EditorStoryElement[] = []

  addRegexElements(elements, transcript, sourceOffset, 'time', /\b(19\d{2}|20\d{2})\b/g, 0.9)
  addRegexElements(
    elements,
    transcript,
    sourceOffset,
    'place',
    /\b(Guangzhou|Shanghai|Beijing|Taipei|Hong Kong|New York|London)\b/g,
    0.75,
  )
  addRegexElements(elements, transcript, sourceOffset, 'place', /(广州|上海|北京|台北|香港|纽约|伦敦)/g, 0.75)
  addRegexElements(
    elements,
    transcript,
    sourceOffset,
    'person',
    /\b(my brother|my sister|my mother|my father)\b/gi,
    0.75,
  )
  addRegexElements(
    elements,
    transcript,
    sourceOffset,
    'person',
    /(我的哥哥|我的姐姐|我的妈妈|我的爸爸)/g,
    0.75,
  )
  addRegexElements(
    elements,
    transcript,
    sourceOffset,
    'emotion',
    /\b(afraid|sad|happy|proud|guilty|scared)\b/gi,
    0.75,
  )
  addRegexElements(
    elements,
    transcript,
    sourceOffset,
    'emotion',
    /(难过|开心|骄傲|内疚|害怕)/g,
    0.75,
  )
  addRegexElements(
    elements,
    transcript,
    sourceOffset,
    'decision',
    /\b(I decided to [^.。]+|I chose to [^.。]+)/gi,
    0.78,
  )
  addRegexElements(elements, transcript, sourceOffset, 'decision', /(我决定[^.!?。！？]+)/g, 0.78)
  addRegexElements(
    elements,
    transcript,
    sourceOffset,
    'consequence',
    /\b(changed my life|taught me [^.。]+)/gi,
    0.78,
  )
  addRegexElements(
    elements,
    transcript,
    sourceOffset,
    'consequence',
    /(让我[^.!?。！？]+|改变了我的人生)/g,
    0.78,
  )
  addRegexElements(
    elements,
    transcript,
    sourceOffset,
    'reflection',
    /\b(I learned [^.。]+|I realized [^.。]+)/gi,
    0.8,
  )
  addRegexElements(elements, transcript, sourceOffset, 'reflection', /(我明白了[^.!?。！？]+)/g, 0.8)

  if (transcript.length > 0) {
    const sourceQuote = transcript.slice(0, Math.min(160, transcript.length))
    elements.push({
      elementType: 'event',
      value: deriveTitle(transcript),
      sourceQuote,
      sourceStartOffset: sourceOffset,
      sourceEndOffset: sourceOffset + sourceQuote.length,
      confidence: 0.7,
    })
  }

  if (/family|mother|father|brother|sister|家|妈妈|爸爸|哥哥|姐姐/i.test(transcript)) {
    const quote = findSentence(
      transcript,
      /family|mother|father|brother|sister|家|妈妈|爸爸|哥哥|姐姐/i,
      sourceOffset,
    )
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
  sourceOffset: number,
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
      sourceStartOffset: sourceOffset + start,
      sourceEndOffset: sourceOffset + start + value.length,
      confidence,
    })
  }
}

function findSentence(transcript: string, pattern: RegExp, sourceOffset: number) {
  const sentences = transcript.match(/[^.!?。！？]+[.!?。！？]?/g) || [transcript]
  let offset = 0

  for (const sentence of sentences) {
    pattern.lastIndex = 0
    if (pattern.test(sentence)) {
      const startTrimOffset = sentence.search(/\S/)
      const text = sentence.trim()
      const start = sourceOffset + offset + startTrimOffset
      return { text, start, end: start + text.length }
    }
    offset += sentence.length
  }

  return {
    text: transcript.slice(0, Math.min(160, transcript.length)),
    start: sourceOffset,
    end: sourceOffset + Math.min(160, transcript.length),
  }
}
