import type { StoryElementType } from '@saga/shared/types/agents'
import {
  PUBLIC_ARCHIVE_CONSENT_COPY_VERSION,
  type PublicArchiveContributionPreview,
  type PublicArchiveElementPreview,
} from '@saga/shared/types/public-archive'

interface StoryInput {
  id: string
  title: string | null
  transcript: string | null
  created_at: string
}

interface ElementInput {
  id: string
  element_type: StoryElementType
  value: string
  normalized_value: string | null
  source_quote: string
  confidence: number
}

const MEDIA_REFERENCE_PATTERNS: Array<[RegExp, string]> = [
  [
    /\b(?:photo|photos|picture|pictures|image|images|snapshot|snapshots)(?:\s+(?:of|from|with|showing)\s+[^,.;!?]+)?/gi,
    '[photo]',
  ],
  [
    /\b(?:voice\s+(?:memo|memos|note|notes|message|messages|recording|recordings)|voicemail|voicemails)(?:\s+(?:of|from|with)\s+[^,.;!?]+)?/gi,
    '[voice]',
  ],
  [
    /\b(?:audio\s+(?:recording|recordings|file|files|clip|clips|message|messages)|sound\s+(?:recording|recordings|file|files|clip|clips))(?:\s+(?:of|from|with)\s+[^,.;!?]+)?/gi,
    '[audio]',
  ],
  [
    /\b(?:media\s+(?:file|files|attachment|attachments|upload|uploads|derivative|derivatives|preview|previews)|uploaded\s+media|media upload|media uploads)(?:\s+(?:of|from|with)\s+[^,.;!?]+)?/gi,
    '[media]',
  ],
]

export function sanitizePublicArchiveText(text: string, privateNames: string[] = []) {
  let output = text
  for (const [pattern, replacement] of MEDIA_REFERENCE_PATTERNS) {
    output = output.replace(pattern, replacement)
  }
  for (const name of privateNames.filter(Boolean)) {
    output = output.replace(new RegExp(escapeRegExp(name), 'gi'), '[person]')
  }
  output = output.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
  // Chinese resident ID (18 digits, optional trailing X). Redacted before phone patterns
  // so the shorter phone regexes cannot match a slice of it.
  output = output.replace(/(?<![0-9])\d{17}[0-9Xx](?![0-9])/g, '[id]')
  // Chinese mobile numbers (11 digits beginning 1[3-9]); redacted before the US pattern.
  output = output.replace(/(?<![0-9])1[3-9]\d{9}(?![0-9])/g, '[phone]')
  output = output.replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, '[phone]')
  output = output.replace(
    /\b\d{1,5}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Way|Boulevard|Blvd)\b/g,
    '[address]',
  )
  return output.replace(/\s+/g, ' ').trim()
}

export function buildContributionPreview(input: {
  previewId: string
  story: StoryInput
  sourceContentHash: string
  elements: ElementInput[]
}): PublicArchiveContributionPreview {
  const privateNames = collectPrivateNames(input.elements)
  const anonymizedTitle = sanitizePublicArchiveText(input.story.title || 'Untitled story', privateNames)
  const anonymizedText = sanitizePublicArchiveText(input.story.transcript || '', privateNames)
  const anonymizedSummary = summarize(anonymizedText)

  return {
    previewId: input.previewId,
    storyId: input.story.id,
    sourceContentHash: input.sourceContentHash,
    consentScope: ['text', 'structured_elements'],
    consentCopyVersion: PUBLIC_ARCHIVE_CONSENT_COPY_VERSION,
    anonymizedTitle,
    anonymizedText,
    anonymizedSummary,
    elements: input.elements.map(element => anonymizeElement(element, privateNames)),
    excludedDataTypes: ['voice', 'audio', 'photos', 'media_derivatives', 'exact_identity'],
  }
}

function anonymizeElement(element: ElementInput, privateNames: string[]): PublicArchiveElementPreview {
  const anonymizedValue =
    element.element_type === 'person' ? '[person]' : sanitizePublicArchiveText(element.value, privateNames)

  return {
    elementType: element.element_type,
    value: anonymizedValue,
    normalizedValue:
      element.element_type === 'person'
        ? '[person]'
        : element.normalized_value
          ? sanitizePublicArchiveText(element.normalized_value, privateNames)
          : null,
    sourceQuote:
      element.element_type === 'person'
        ? '[person]'
        : element.source_quote
          ? sanitizePublicArchiveText(element.source_quote, privateNames)
          : null,
    confidence: element.confidence,
  }
}

function summarize(text: string) {
  if (text.length <= 220) return text
  return `${text.slice(0, 217).trimEnd()}...`
}

// Person elements are the only reliable basis for name redaction, so collect every
// name form they expose (value, normalized value, and the original source quote).
// Redacting source quotes too closes the leak where a fuller name ("Auntie Lin Mei")
// appears in the transcript while the element value is only a fragment ("Auntie").
function collectPrivateNames(elements: ElementInput[]): string[] {
  const names = new Set<string>()
  for (const element of elements) {
    if (element.element_type !== 'person') continue
    for (const candidate of [element.value, element.normalized_value, element.source_quote]) {
      if (typeof candidate === 'string' && candidate.trim().length >= 2) {
        names.add(candidate.trim())
      }
    }
  }
  // Longest first so multi-token names are removed before their fragments, avoiding
  // orphaned tokens (e.g. redact "Lin Mei" before "Lin").
  return [...names].sort((a, b) => b.length - a.length)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
