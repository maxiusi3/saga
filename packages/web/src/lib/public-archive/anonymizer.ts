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

export function sanitizePublicArchiveText(text: string, privateNames: string[] = []) {
  let output = text
  for (const name of privateNames.filter(Boolean)) {
    output = output.replace(new RegExp(escapeRegExp(name), 'gi'), '[person]')
  }
  output = output.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
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
  const privateNames = input.elements
    .filter(element => element.element_type === 'person')
    .map(element => element.value)
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
    sourceQuote: element.source_quote ? sanitizePublicArchiveText(element.source_quote, privateNames) : null,
    confidence: element.confidence,
  }
}

function summarize(text: string) {
  if (text.length <= 220) return text
  return `${text.slice(0, 217).trimEnd()}...`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
