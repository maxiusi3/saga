import { generateInterviewIntervention } from '../interview-agent'

describe('generateInterviewIntervention', () => {
  it('returns no prompt when intervention level is off', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'off',
      phase: 'opening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about your first home.',
      recentTranscript: '',
      previousStorySummary: null,
      previousPrompts: [],
      silenceMs: 0,
    })

    expect(result).toEqual({
      shouldIntervene: false,
      eventKind: null,
      triggerReason: 'intervention_level_off',
      promptText: '',
    })
  })

  it('creates a short opening at low intervention level', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'low',
      phase: 'opening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about your first home.',
      recentTranscript: '',
      previousStorySummary: null,
      previousPrompts: [],
      silenceMs: 0,
    })

    expect(result.shouldIntervene).toBe(true)
    expect(result.eventKind).toBe('opening')
    expect(result.promptText).toContain('John')
    expect(result.promptText.length).toBeLessThanOrEqual(220)
  })

  it('uses prior story recap when available at high level', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'high',
      phase: 'prior_story_recap',
      storytellerName: 'Mei',
      currentPrompt: 'Tell me about moving to the city.',
      recentTranscript: '',
      previousStorySummary: 'Last time you described leaving your village by train.',
      previousPrompts: [],
      silenceMs: 0,
    })

    expect(result.shouldIntervene).toBe(true)
    expect(result.eventKind).toBe('prior_story_recap')
    expect(result.promptText).toContain('Last time')
  })

  it('does not probe during low-level short silence', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'low',
      phase: 'story_listening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about school.',
      recentTranscript: 'I walked there with my brother.',
      previousStorySummary: null,
      previousPrompts: [],
      silenceMs: 5000,
    })

    expect(result.shouldIntervene).toBe(false)
    expect(result.triggerReason).toBe('listening_without_interrupting')
  })

  it('offers emotional support for negative emotional cues', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'low',
      phase: 'story_listening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about your family.',
      recentTranscript: 'That was a painful time and I still feel guilty.',
      previousStorySummary: null,
      previousPrompts: [],
      silenceMs: 3000,
    })

    expect(result.shouldIntervene).toBe(true)
    expect(result.eventKind).toBe('emotional_support')
    expect(result.promptText).toContain('pause')
  })
})
