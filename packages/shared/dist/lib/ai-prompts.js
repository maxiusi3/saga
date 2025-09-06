"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_PROMPT_CHAPTERS = void 0;
exports.getAllPrompts = getAllPrompts;
exports.getPromptsByChapter = getPromptsByChapter;
exports.getNextPrompt = getNextPrompt;
exports.getPromptById = getPromptById;
exports.getChapterProgress = getChapterProgress;
// AI Prompt Library organized by chapters
exports.AI_PROMPT_CHAPTERS = [
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
                estimatedTime: 5
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
                estimatedTime: 6
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
                estimatedTime: 5
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
                estimatedTime: 4
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
                estimatedTime: 6
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
                estimatedTime: 5
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
                estimatedTime: 6
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
                estimatedTime: 5
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
                estimatedTime: 7
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
                estimatedTime: 6
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
                estimatedTime: 8
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
                estimatedTime: 8
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
                estimatedTime: 6
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
                estimatedTime: 7
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
                estimatedTime: 8
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
                estimatedTime: 7
            }
        ]
    }
];
// Helper functions
function getAllPrompts() {
    return exports.AI_PROMPT_CHAPTERS.flatMap(chapter => chapter.prompts);
}
function getPromptsByChapter(chapterNumber) {
    const chapter = exports.AI_PROMPT_CHAPTERS.find(c => c.number === chapterNumber);
    return chapter ? chapter.prompts : [];
}
function getNextPrompt(currentPromptId) {
    const allPrompts = getAllPrompts();
    if (!currentPromptId) {
        return allPrompts[0] || null;
    }
    const currentIndex = allPrompts.findIndex(p => p.id === currentPromptId);
    if (currentIndex === -1 || currentIndex === allPrompts.length - 1) {
        return null;
    }
    return allPrompts[currentIndex + 1];
}
function getPromptById(id) {
    const allPrompts = getAllPrompts();
    return allPrompts.find(p => p.id === id) || null;
}
function getChapterProgress(completedPromptIds) {
    const progress = {};
    exports.AI_PROMPT_CHAPTERS.forEach(chapter => {
        const completedInChapter = chapter.prompts.filter(p => completedPromptIds.includes(p.id)).length;
        progress[chapter.number] = {
            completed: completedInChapter,
            total: chapter.prompts.length
        };
    });
    return progress;
}
//# sourceMappingURL=ai-prompts.js.map