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

  it('keeps opening prompt bounded when current prompt is long', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'low',
      phase: 'opening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about your first home. '.repeat(20),
      recentTranscript: '',
      previousStorySummary: null,
      previousPrompts: [],
      silenceMs: 0,
    })

    expect(result.shouldIntervene).toBe(true)
    expect(result.eventKind).toBe('opening')
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

  it('keeps prior story recap bounded when summary is long', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'high',
      phase: 'prior_story_recap',
      storytellerName: 'Mei',
      currentPrompt: 'Tell me about moving to the city.',
      recentTranscript: '',
      previousStorySummary: 'Last time you described leaving your village by train. '.repeat(20),
      previousPrompts: [],
      silenceMs: 0,
    })

    expect(result.shouldIntervene).toBe(true)
    expect(result.eventKind).toBe('prior_story_recap')
    expect(result.promptText.length).toBeLessThanOrEqual(220)
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

  it('does not interrupt fluent storytelling for negative emotional language', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'low',
      phase: 'story_listening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about your family.',
      recentTranscript: 'That was a painful time and I still feel guilty, but then my sister helped me understand what happened next.',
      previousStorySummary: null,
      previousPrompts: [],
      silenceMs: 0,
    })

    expect(result.shouldIntervene).toBe(false)
    expect(result.triggerReason).toBe('listening_without_interrupting')
  })

  it('does not repeat gentle probes after all have been used', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'high',
      phase: 'story_listening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about school.',
      recentTranscript: 'I walked there with my brother.',
      previousStorySummary: null,
      previousPrompts: [
        'What happened next?',
        'Who else was there with you?',
        'Can you describe what the place looked or sounded like?',
        'What were you feeling in that moment?',
      ],
      silenceMs: 12000,
    })

    expect(result.shouldIntervene).toBe(false)
    expect(result.triggerReason).toBe('gentle_probe_exhausted')
  })

  it('normalizes previous prompts before avoiding repeats', () => {
    const result = generateInterviewIntervention({
      interventionLevel: 'high',
      phase: 'story_listening',
      storytellerName: 'John',
      currentPrompt: 'Tell me about school.',
      recentTranscript: 'I walked there with my brother.',
      previousStorySummary: null,
      previousPrompts: [
        ' what happened next? ',
        'WHO ELSE WAS THERE WITH YOU?',
        'Can you describe what the place looked or sounded like?',
      ],
      silenceMs: 12000,
    })

    expect(result.shouldIntervene).toBe(true)
    expect(result.promptText).toBe('What were you feeling in that moment?')
  })
})
