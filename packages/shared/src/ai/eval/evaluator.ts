import { SAGA_BASE_PRINCIPLES } from '../base'
import { normalizeAiLocale } from '../language'
import type { AiMessage } from '../types'
import { chapterDraftTask, projectSummaryTask } from '../tasks/biography'
import { projectQuestionsTask, realtimeFollowupTask } from '../tasks/followups'
import {
  StoryEditValidationError,
  factReviewTask,
  paragraphEditorTask,
} from '../tasks/story-edit'
import { storyMetadataTask } from '../tasks/story-metadata'
import {
  AI_EVAL_FIXTURES,
  type AiEvalFixture,
  type EvalInvariantRules,
  type EvalStandardTaskCase,
} from './fixtures'

export interface EvalCheckOutcome {
  passed: boolean
  reasons: string[]
}

export interface EvalResultEntry {
  fixtureId: string
  category: string
  taskId: string
  checkName: string
  kind: 'prompt_safety' | 'reference_accept' | 'planted_reject'
  passed: boolean
  detail: string
}

export interface AiEvalReport {
  passed: boolean
  totalChecks: number
  passedChecks: number
  failedChecks: number
  taskVersions: Record<string, string>
  results: EvalResultEntry[]
}

export function evaluatePromptSafety(
  messages: AiMessage[],
  forbiddenSystemTerms: string[] = [],
): EvalCheckOutcome {
  const reasons: string[] = []
  if (messages.length < 2 || messages[0].role !== 'system' || messages[1].role !== 'user') {
    reasons.push('Expected [system, user] message pair')
    return { passed: false, reasons }
  }

  const system = messages[0].content
  const user = messages[1].content

  if (!system.startsWith(SAGA_BASE_PRINCIPLES)) {
    reasons.push('System prompt does not start with SAGA_BASE_PRINCIPLES')
  }
  if (!user.includes('<source_material')) {
    reasons.push('User message does not wrap family data in <source_material>')
  }

  const openCount = (user.match(/<source_material\b/g) ?? []).length
  const closeCount = (user.match(/<\/source_material>/g) ?? []).length
  if (openCount !== 1 || closeCount !== 1) {
    reasons.push(`Expected 1 <source_material> block, got open=${openCount} close=${closeCount}`)
  }

  for (const term of forbiddenSystemTerms) {
    if (term && system.includes(term)) {
      reasons.push(`System prompt leaked family/input term: ${term}`)
    }
  }

  return { passed: reasons.length === 0, reasons }
}

export function evaluateTextInvariants(text: string, rules: EvalInvariantRules): EvalCheckOutcome {
  const reasons: string[] = []

  for (const required of rules.requiredTerms ?? []) {
    if (!text.includes(required)) {
      reasons.push(`Missing required term: ${required}`)
    }
  }

  for (const forbidden of rules.forbiddenTerms ?? []) {
    if (text.includes(forbidden)) {
      reasons.push(`Contains forbidden term: ${forbidden}`)
    }
  }

  if (rules.expectedLocale) {
    const normalized = normalizeAiLocale(rules.expectedLocale)
    if (normalized.startsWith('zh') && !/[\u4e00-\u9fff]/.test(text)) {
      reasons.push(`Expected Chinese characters for locale ${normalized}`)
    } else if (normalized === 'en' && !/[a-zA-Z]/.test(text)) {
      reasons.push('Expected English text for locale en')
    }
  }

  return { passed: reasons.length === 0, reasons }
}

function serializeParsedOutput(output: unknown): string {
  if (typeof output === 'string') return output
  return JSON.stringify(output)
}

function runStandardCase(entry: EvalStandardTaskCase): {
  safety: EvalCheckOutcome
  buildAndParse: (raw: string) => unknown
} {
  switch (entry.taskId) {
    case 'story_metadata':
      return {
        safety: evaluatePromptSafety(storyMetadataTask.buildMessages(entry.input), entry.forbiddenSystemTerms),
        buildAndParse: raw => storyMetadataTask.parse(raw),
      }
    case 'followup_realtime':
      return {
        safety: evaluatePromptSafety(realtimeFollowupTask.buildMessages(entry.input), entry.forbiddenSystemTerms),
        buildAndParse: raw => realtimeFollowupTask.parse(raw),
      }
    case 'followup_project':
      return {
        safety: evaluatePromptSafety(projectQuestionsTask.buildMessages(entry.input), entry.forbiddenSystemTerms),
        buildAndParse: raw => projectQuestionsTask.parse(raw),
      }
    case 'chapter_draft':
      return {
        safety: evaluatePromptSafety(chapterDraftTask.buildMessages(entry.input), entry.forbiddenSystemTerms),
        buildAndParse: raw => chapterDraftTask.parse(raw),
      }
    case 'project_summary':
      return {
        safety: evaluatePromptSafety(projectSummaryTask.buildMessages(entry.input), entry.forbiddenSystemTerms),
        buildAndParse: raw => projectSummaryTask.parse(raw),
      }
  }
}

export function runOfflineAiEvalSuite(fixtures: AiEvalFixture[] = AI_EVAL_FIXTURES): AiEvalReport {
  const results: EvalResultEntry[] = []

  const record = (
    fixture: AiEvalFixture,
    taskId: string,
    checkName: string,
    kind: EvalResultEntry['kind'],
    passed: boolean,
    detail: string,
  ) => {
    results.push({
      fixtureId: fixture.id,
      category: fixture.category,
      taskId,
      checkName,
      kind,
      passed,
      detail,
    })
  }

  for (const fixture of fixtures) {
    for (const item of fixture.cases) {
      if (item.kind === 'standard') {
        const { safety, buildAndParse } = runStandardCase(item)
        record(
          fixture,
          item.taskId,
          'prompt_safety',
          'prompt_safety',
          safety.passed,
          safety.passed ? 'system base + isolated <source_material>' : safety.reasons.join('; '),
        )

        try {
          const parsed = buildAndParse(item.referenceRaw)
          const inv = evaluateTextInvariants(serializeParsedOutput(parsed), item.rules)
          record(
            fixture,
            item.taskId,
            'reference_accept',
            'reference_accept',
            inv.passed,
            inv.passed ? 'parsed and satisfied invariants' : inv.reasons.join('; '),
          )
        } catch (error) {
          record(
            fixture,
            item.taskId,
            'reference_accept',
            'reference_accept',
            false,
            `Reference output rejected: ${error instanceof Error ? error.message : String(error)}`,
          )
        }

        for (const bad of item.plantedBadCases) {
          let parsed: unknown
          let threw = false
          try {
            parsed = buildAndParse(bad.raw)
          } catch {
            threw = true
          }

          if (bad.expectedFailure === 'parse') {
            record(
              fixture,
              item.taskId,
              `planted_reject:${bad.label}`,
              'planted_reject',
              threw,
              threw ? 'rejected by strict parser' : 'unexpectedly passed strict parser',
            )
          } else {
            const inv = threw
              ? { passed: false, reasons: ['rejected by parser'] }
              : evaluateTextInvariants(serializeParsedOutput(parsed), item.rules)
            record(
              fixture,
              item.taskId,
              `planted_reject:${bad.label}`,
              'planted_reject',
              !inv.passed,
              !inv.passed ? `detected: ${inv.reasons.join('; ')}` : 'missed planted defect',
            )
          }
        }
      } else {
        const editorPayload = paragraphEditorTask.buildUserPayload(item.segments)
        const reviewerPayload = factReviewTask.buildUserPayload(item.segments, item.faithfulParagraphs)
        const safetyReasons: string[] = []
        if (!paragraphEditorTask.systemPrompt.startsWith(SAGA_BASE_PRINCIPLES)) {
          safetyReasons.push('Editor system prompt missing SAGA_BASE_PRINCIPLES')
        }
        if (!factReviewTask.systemPrompt.startsWith(SAGA_BASE_PRINCIPLES)) {
          safetyReasons.push('Reviewer system prompt missing SAGA_BASE_PRINCIPLES')
        }
        for (const seg of item.segments) {
          if (paragraphEditorTask.systemPrompt.includes(seg.text)) {
            safetyReasons.push('Editor system prompt contains source segment text')
          }
        }
        try {
          const parsedEditorInput = JSON.parse(editorPayload) as { segments?: unknown[] }
          if (!Array.isArray(parsedEditorInput.segments) || parsedEditorInput.segments.length !== item.segments.length) {
            safetyReasons.push('Editor payload did not serialize segments')
          }
          const parsedReviewerInput = JSON.parse(reviewerPayload) as { segments?: unknown[]; paragraphs?: unknown[] }
          if (!Array.isArray(parsedReviewerInput.segments) || !Array.isArray(parsedReviewerInput.paragraphs)) {
            safetyReasons.push('Reviewer payload missing segments or paragraphs')
          }
        } catch {
          safetyReasons.push('Story-edit payload is not valid JSON')
        }
        record(
          fixture,
          paragraphEditorTask.id,
          'story_edit_prompt_safety',
          'prompt_safety',
          safetyReasons.length === 0,
          safetyReasons.length === 0 ? 'base principles + isolated JSON payloads' : safetyReasons.join('; '),
        )

        try {
          const edited = paragraphEditorTask.parse({ paragraphs: item.faithfulParagraphs }, item.segments)
          const inv = evaluateTextInvariants(edited.map(p => p.text).join('\n'), item.rules)
          const verdicts = factReviewTask.parse({ paragraphs: item.faithfulVerdicts }, edited)
          const ok = inv.passed && verdicts.length === edited.length
          record(
            fixture,
            `${paragraphEditorTask.id}+${factReviewTask.id}`,
            'reference_accept',
            'reference_accept',
            ok,
            ok ? 'faithful edit & review accepted' : inv.reasons.join('; '),
          )
        } catch (error) {
          record(
            fixture,
            `${paragraphEditorTask.id}+${factReviewTask.id}`,
            'reference_accept',
            'reference_accept',
            false,
            `Faithful story-edit rejected: ${error instanceof Error ? error.message : String(error)}`,
          )
        }

        for (const bad of item.plantedBadParagraphs) {
          let parsed: ReturnType<typeof paragraphEditorTask.parse> | null = null
          let threw = false
          try {
            parsed = paragraphEditorTask.parse(bad.raw, item.segments)
          } catch {
            threw = true
          }

          if (bad.expectedFailure === 'parse') {
            record(
              fixture,
              paragraphEditorTask.id,
              `planted_reject:${bad.label}`,
              'planted_reject',
              threw,
              threw ? 'rejected by citation/timing parser' : 'unexpectedly passed citation parser',
            )
          } else {
            const inv = threw || !parsed
              ? { passed: false, reasons: ['rejected by parser'] }
              : evaluateTextInvariants(parsed.map(p => p.text).join('\n'), item.rules)
            record(
              fixture,
              paragraphEditorTask.id,
              `planted_reject:${bad.label}`,
              'planted_reject',
              !inv.passed,
              !inv.passed ? `detected: ${inv.reasons.join('; ')}` : 'missed planted edit defect',
            )
          }
        }

        for (const badReview of item.plantedBadReviews) {
          let matchedCode: string | null = null
          try {
            factReviewTask.parse(badReview.raw, item.faithfulParagraphs)
          } catch (error) {
            if (error instanceof StoryEditValidationError) {
              matchedCode = error.code
            }
          }
          const ok = matchedCode === badReview.expectedCode
          record(
            fixture,
            factReviewTask.id,
            `planted_review_reject:${badReview.label}`,
            'planted_reject',
            ok,
            ok ? `rejected with ${matchedCode}` : `expected ${badReview.expectedCode}, got ${matchedCode ?? 'accepted'}`,
          )
        }
      }
    }
  }

  const passedChecks = results.filter(r => r.passed).length
  const totalChecks = results.length
  const failedChecks = totalChecks - passedChecks

  return {
    passed: failedChecks === 0,
    totalChecks,
    passedChecks,
    failedChecks,
    taskVersions: {
      [storyMetadataTask.id]: storyMetadataTask.version,
      [realtimeFollowupTask.id]: realtimeFollowupTask.version,
      [projectQuestionsTask.id]: projectQuestionsTask.version,
      [chapterDraftTask.id]: chapterDraftTask.version,
      [projectSummaryTask.id]: projectSummaryTask.version,
      [paragraphEditorTask.id]: paragraphEditorTask.version,
      [factReviewTask.id]: factReviewTask.version,
    },
    results,
  }
}

export function formatAiEvalReportMarkdown(report: AiEvalReport): string {
  const status = report.passed ? 'PASSED' : 'FAILED'
  const lines = [
    `# UR Saga Offline AI Eval Report: ${status}`,
    '',
    `- Total checks: ${report.totalChecks}`,
    `- Passed: ${report.passedChecks}`,
    `- Failed: ${report.failedChecks}`,
    '',
    '## Task Versions',
    ...Object.entries(report.taskVersions).map(([id, version]) => `- \`${id}\`: \`${version}\``),
    '',
    '## Checks',
    '| Fixture | Task | Check | Result | Detail |',
    '|---|---|---|---|---|',
    ...report.results.map(
      row =>
        `| ${row.fixtureId} | ${row.taskId} | ${row.checkName} | ${row.passed ? 'PASS' : 'FAIL'} | ${row.detail.replace(/\|/g, '\\|')} |`,
    ),
  ]
  return lines.join('\n')
}
