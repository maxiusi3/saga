export interface StoryPrompt {
  id: string
  chapter: string
  chapterNumber: number
  category: string
  text: string
  followUpSuggestions?: string[]
  estimatedTime: number // in minutes
  comfortTip?: string
  facilitatorNote?: string
  isGentleStarter?: boolean
}

export interface PromptChapter {
  id: string
  title: string
  number: number
  description: string
  prompts: StoryPrompt[]
}

// AI Prompt Library organized by chapters
export const AI_PROMPT_CHAPTERS: PromptChapter[] = [
  {
    id: 'childhood',
    title: 'Childhood Memories',
    number: 1,
    description: 'Early life experiences and formative memories',
    prompts: [
      {
        id: 'first-memory',
        chapter: 'Childhood Memories',
        chapterNumber: 1,
        category: 'Early Life',
        text: 'What is your earliest childhood memory? Can you describe what you remember about that moment?',
        followUpSuggestions: [
          'How old do you think you were?',
          'Who else was there with you?',
          'How did that memory make you feel?'
        ],
        estimatedTime: 5,
        comfortTip: 'Even a brief fragment, a smell, or a single room is enough—there is no need to tell everything in order.',
        facilitatorNote: 'If this feels too broad, start with a favorite childhood snack or switch to a lighter question.',
        isGentleStarter: false
      },
      {
        id: 'childhood-home',
        chapter: 'Childhood Memories',
        chapterNumber: 1,
        category: 'Home & Family',
        text: 'Tell me about the house you grew up in. What did it look like, and what was your favorite room?',
        followUpSuggestions: [
          'What made that room special to you?',
          'What sounds and smells do you remember?',
          'Did you have your own room or share with siblings?'
        ],
        estimatedTime: 6,
        comfortTip: 'Picture walking through the front door in your mind. Ordinary rooms and kitchen smells make the richest stories.',
        facilitatorNote: 'Great to ask while looking at an old neighborhood map or family photo together.',
        isGentleStarter: true
      },
      {
        id: 'childhood-friends',
        chapter: 'Childhood Memories',
        chapterNumber: 1,
        category: 'Relationships',
        text: 'Who was your best friend when you were young? What adventures did you have together?',
        followUpSuggestions: [
          'How did you meet this friend?',
          'What games did you play together?',
          'Are you still in touch with them?'
        ],
        estimatedTime: 5,
        comfortTip: 'No worries if you forget their last name—just share what you used to laugh about or play together.',
        facilitatorNote: 'Asking about childhood games or mischief is an easy, joyful icebreaker over tea.',
        isGentleStarter: true
      },
      {
        id: 'school-days',
        chapter: 'Childhood Memories',
        chapterNumber: 1,
        category: 'Education',
        text: 'What do you remember about your first day of school? How did you feel?',
        followUpSuggestions: [
          'Who was your favorite teacher?',
          'What subject did you enjoy most?',
          'Did you walk to school or take the bus?'
        ],
        estimatedTime: 4,
        comfortTip: 'Just one small snapshot—like what you carried to school or who walked with you—is wonderful.',
        facilitatorNote: 'Keep it light: ask what lunch, shoes, or walk to school was like.',
        isGentleStarter: true
      },
      {
        id: 'family-traditions',
        chapter: 'Childhood Memories',
        chapterNumber: 1,
        category: 'Family',
        text: 'What was a special tradition your family had when you were growing up?',
        followUpSuggestions: [
          'How did this tradition start?',
          'What was your role in it?',
          'Did you continue this tradition with your own family?'
        ],
        estimatedTime: 6,
        comfortTip: 'Even a simple weekend routine or a favorite holiday dish counts as a cherished family tradition.',
        facilitatorNote: 'Ideal before a holiday or family dinner—ask about a dish or song everyone remembers.',
        isGentleStarter: true
      }
    ]
  },
  {
    id: 'young-adulthood',
    title: 'Young Adulthood',
    number: 2,
    description: 'Coming of age, education, and early independence',
    prompts: [
      {
        id: 'first-job',
        chapter: 'Young Adulthood',
        chapterNumber: 2,
        category: 'Career',
        text: 'Tell me about your first job. What was it like walking in on your first day?',
        followUpSuggestions: [
          'What were your coworkers like?',
          'What was the most challenging part?',
          'What did you learn from that experience?'
        ],
        estimatedTime: 5,
        comfortTip: 'You do not have to cover your whole career—just talk about that first day or what you bought with your first paycheck.',
        facilitatorNote: 'Adult children often bond deeply hearing what their parents were like at age 18–22.',
        isGentleStarter: true
      },
      {
        id: 'teenage-dreams',
        chapter: 'Young Adulthood',
        chapterNumber: 2,
        category: 'Aspirations',
        text: 'When you were a teenager, what did you dream of becoming? How did those dreams shape your choices?',
        followUpSuggestions: [
          'Did any of those dreams come true?',
          'What influenced those dreams?',
          'How did your dreams change over time?'
        ],
        estimatedTime: 6,
        comfortTip: 'It is completely okay if life went in a different direction—share whatever hobby, song, or hope excited you then.',
        facilitatorNote: 'Frame this with curiosity, not evaluation—ask who their favorite singer or hero was.',
        isGentleStarter: false
      },
      {
        id: 'independence',
        chapter: 'Young Adulthood',
        chapterNumber: 2,
        category: 'Life Transitions',
        text: 'Tell me about the first time you lived on your own. What was that experience like?',
        followUpSuggestions: [
          'What was the hardest part about being independent?',
          'What did you learn about yourself?',
          'What advice would you give to someone moving out for the first time?'
        ],
        estimatedTime: 5,
        comfortTip: 'Everyday details—like cooking your first meal alone or furnishing a tiny room—are what your family loves hearing.',
        facilitatorNote: 'Great bridge for comparing your own first apartment with theirs.',
        isGentleStarter: true
      }
    ]
  },
  {
    id: 'love-family',
    title: 'Love & Family',
    number: 3,
    description: 'Relationships, marriage, and building a family',
    prompts: [
      {
        id: 'meeting-spouse',
        chapter: 'Love & Family',
        chapterNumber: 3,
        category: 'Romance',
        text: 'Tell me about the day you met your spouse. What was your first impression?',
        followUpSuggestions: [
          'Where did you meet?',
          'What attracted you to them?',
          'When did you know they were "the one"?'
        ],
        estimatedTime: 7,
        comfortTip: 'Keep it as short or long as feels comfortable—just share where you were or a funny moment from early on.',
        facilitatorNote: 'If family history around marriage is sensitive, offer to switch to a lighter question anytime.',
        isGentleStarter: true
      },
      {
        id: 'wedding-day',
        chapter: 'Love & Family',
        chapterNumber: 3,
        category: 'Milestones',
        text: 'What do you remember most about your wedding day? What made it special?',
        followUpSuggestions: [
          'What was the most memorable moment?',
          'Were there any funny mishaps?',
          'What advice would you give to newlyweds?'
        ],
        estimatedTime: 6,
        comfortTip: 'Forget exact schedules—share what the weather was like, what you wore, or a small funny surprise.',
        facilitatorNote: 'Hold a wedding photo in front of you both so the memory flows naturally.',
        isGentleStarter: false
      },
      {
        id: 'becoming-parent',
        chapter: 'Love & Family',
        chapterNumber: 3,
        category: 'Parenthood',
        text: 'What was it like becoming a parent for the first time? How did it change you?',
        followUpSuggestions: [
          'What surprised you most about parenthood?',
          'What was your biggest fear as a new parent?',
          'What brought you the most joy?'
        ],
        estimatedTime: 8,
        comfortTip: 'Being honest about how tired, nervous, or amazed you felt is deeply comforting for your children to hear.',
        facilitatorNote: 'Let them know they do not need to sound like an expert—their real feelings back then are the gift.',
        isGentleStarter: false
      }
    ]
  },
  {
    id: 'life-lessons',
    title: 'Life Lessons & Wisdom',
    number: 4,
    description: 'Challenges overcome and wisdom gained',
    prompts: [
      {
        id: 'biggest-challenge',
        chapter: 'Life Lessons & Wisdom',
        chapterNumber: 4,
        category: 'Challenges',
        text: 'What was one of the biggest challenges you faced in your life, and how did you overcome it?',
        followUpSuggestions: [
          'What helped you get through it?',
          'What did you learn from that experience?',
          'How did it change your perspective?'
        ],
        estimatedTime: 8,
        comfortTip: 'Only share what feels safe today—you can always pause, skip painful parts, or switch to a lighter story.',
        facilitatorNote: 'Never force heavy topics early; save this for when your parent feels relaxed and ready.',
        isGentleStarter: false
      },
      {
        id: 'proudest-moment',
        chapter: 'Life Lessons & Wisdom',
        chapterNumber: 4,
        category: 'Achievements',
        text: 'What is one of your proudest moments? What made it so meaningful to you?',
        followUpSuggestions: [
          'Who shared that moment with you?',
          'How did you celebrate?',
          'What led up to that achievement?'
        ],
        estimatedTime: 6,
        comfortTip: 'Pride does not have to mean a big award—helping a neighbor, raising family, or learning a skill all count.',
        facilitatorNote: 'Remind modest parents that quiet everyday faithfulness is something the family deeply admires.',
        isGentleStarter: true
      },
      {
        id: 'life-advice',
        chapter: 'Life Lessons & Wisdom',
        chapterNumber: 4,
        category: 'Wisdom',
        text: 'If you could give one piece of advice to your younger self, what would it be?',
        followUpSuggestions: [
          'Why is this advice important?',
          'What experiences taught you this lesson?',
          'How would your life have been different?'
        ],
        estimatedTime: 7,
        comfortTip: 'No need to sound philosophical—even a simple reminder like "rest more" or "call your friends" is gold.',
        facilitatorNote: 'Keep the tone playful rather than solemn so it does not feel like a farewell speech.',
        isGentleStarter: false
      }
    ]
  },
  {
    id: 'legacy-reflections',
    title: 'Legacy & Reflections',
    number: 5,
    description: 'Looking back and forward, values and hopes',
    prompts: [
      {
        id: 'family-values',
        chapter: 'Legacy & Reflections',
        chapterNumber: 5,
        category: 'Values',
        text: 'What values are most important to you, and how did you try to pass them on to your children?',
        followUpSuggestions: [
          'Where did these values come from?',
          'How do you see these values in your children today?',
          'What would you want future generations to remember?'
        ],
        estimatedTime: 8,
        comfortTip: 'Think of a small everyday habit—like sharing meals or keeping your word—rather than a formal speech.',
        facilitatorNote: 'Share one value you personally learned from them first to ease into this conversation.',
        isGentleStarter: false
      },
      {
        id: 'hopes-future',
        chapter: 'Legacy & Reflections',
        chapterNumber: 5,
        category: 'Future',
        text: 'What are your hopes and dreams for your children and grandchildren?',
        followUpSuggestions: [
          'What kind of world do you hope they inherit?',
          'What do you want them to remember about you?',
          'What legacy do you hope to leave?'
        ],
        estimatedTime: 7,
        comfortTip: 'A simple wish in your own voice—just like a birthday blessing—is more than enough.',
        facilitatorNote: 'Framing this as a warm blessing for grandchildren avoids triggering end-of-life anxiety.',
        isGentleStarter: false
      }
    ]
  }
]

// Helper functions
export function getAllPrompts(): StoryPrompt[] {
  return AI_PROMPT_CHAPTERS.flatMap(chapter => chapter.prompts)
}

export function getPromptsByChapter(chapterNumber: number): StoryPrompt[] {
  const chapter = AI_PROMPT_CHAPTERS.find(c => c.number === chapterNumber)
  return chapter ? chapter.prompts : []
}

export function getNextPrompt(currentPromptId?: string): StoryPrompt | null {
  const allPrompts = getAllPrompts()

  if (!currentPromptId) {
    return allPrompts[0] || null
  }

  const currentIndex = allPrompts.findIndex(p => p.id === currentPromptId)
  if (currentIndex === -1 || currentIndex === allPrompts.length - 1) {
    return null
  }

  return allPrompts[currentIndex + 1]
}

export function getPromptById(id: string): StoryPrompt | null {
  const allPrompts = getAllPrompts()
  return allPrompts.find(p => p.id === id) || null
}

/**
 * Cycle to a low-pressure, sensory prompt so storytellers or facilitators can
 * switch away from a heavy or blank-page question with one tap.
 */
export function getAlternateGentlePrompt(currentPromptId?: string): StoryPrompt {
  const allPrompts = getAllPrompts()
  const gentlePrompts = allPrompts.filter(p => p.isGentleStarter)
  const pool = gentlePrompts.length > 0 ? gentlePrompts : allPrompts

  if (!currentPromptId) {
    return pool[0]
  }

  const currentGentleIndex = pool.findIndex(p => p.id === currentPromptId)
  if (currentGentleIndex !== -1) {
    return pool[(currentGentleIndex + 1) % pool.length]
  }

  const allIndex = allPrompts.findIndex(p => p.id === currentPromptId)
  if (allIndex !== -1) {
    const nextInAll = allPrompts.slice(allIndex + 1).find(p => p.isGentleStarter)
    if (nextInAll) return nextInAll
  }

  return pool[0]
}

// For backward compatibility, export StoryPrompt as AIPrompt
export type AIPrompt = StoryPrompt

export function getChapterProgress(completedPromptIds: string[]): { [chapterNumber: number]: { completed: number; total: number } } {
  const progress: { [chapterNumber: number]: { completed: number; total: number } } = {}
  
  AI_PROMPT_CHAPTERS.forEach(chapter => {
    const completedInChapter = chapter.prompts.filter(p => completedPromptIds.includes(p.id)).length
    progress[chapter.number] = {
      completed: completedInChapter,
      total: chapter.prompts.length
    }
  })
  
  return progress
}
