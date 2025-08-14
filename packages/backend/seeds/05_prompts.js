const { v4: uuidv4 } = require('uuid');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('user_prompts').del();
  await knex('prompts').del();

  // Insert library prompts
  const libraryPrompts = [
    // Childhood prompts
    {
      id: uuidv4(),
      text: 'Tell me about your favorite childhood memory. What made it so special?',
      category: 'childhood',
      difficulty: 'easy',
      follow_up_questions: JSON.stringify([
        'Who else was there with you?',
        'How did that make you feel?',
        'Do you still think about that memory today?'
      ]),
      tags: JSON.stringify(['memory', 'emotion', 'place']),
      is_library_prompt: true,
      template_id: 'childhood_001',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'What was your favorite place to play when you were a child?',
      category: 'childhood',
      difficulty: 'easy',
      follow_up_questions: JSON.stringify([
        'What games did you play there?',
        'Did you play alone or with others?',
        'What made that place special?'
      ]),
      tags: JSON.stringify(['place', 'play', 'memory']),
      is_library_prompt: true,
      template_id: 'childhood_002',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'What was your favorite subject in school and why?',
      category: 'childhood',
      difficulty: 'medium',
      follow_up_questions: JSON.stringify([
        'Who was your favorite teacher?',
        'What did you learn that you still remember?',
        'How did that subject influence your later choices?'
      ]),
      tags: JSON.stringify(['learning', 'school', 'education']),
      is_library_prompt: true,
      template_id: 'childhood_003',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },

    // Family prompts
    {
      id: uuidv4(),
      text: 'What was your favorite family tradition growing up?',
      category: 'family',
      difficulty: 'easy',
      follow_up_questions: JSON.stringify([
        'Do you still celebrate this tradition?',
        'What did this tradition mean to your family?',
        'Have you passed this tradition to your children?'
      ]),
      tags: JSON.stringify(['tradition', 'celebration', 'family']),
      is_library_prompt: true,
      template_id: 'family_001',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'What was your mother like? What do you remember most about her?',
      category: 'family',
      difficulty: 'medium',
      follow_up_questions: JSON.stringify([
        'What values did she teach you?',
        'How are you similar to her?',
        'What would you want her to know about your life now?'
      ]),
      tags: JSON.stringify(['mother', 'parent', 'values']),
      is_library_prompt: true,
      template_id: 'family_002',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'Tell me about holiday celebrations in your family.',
      category: 'family',
      difficulty: 'easy',
      follow_up_questions: JSON.stringify([
        'What was your favorite holiday?',
        'Who usually hosted the celebrations?',
        'What foods were always served?'
      ]),
      tags: JSON.stringify(['holiday', 'celebration', 'tradition']),
      is_library_prompt: true,
      template_id: 'family_003',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },

    // Career prompts
    {
      id: uuidv4(),
      text: 'What was your first job? How did you get it?',
      category: 'career',
      difficulty: 'easy',
      follow_up_questions: JSON.stringify([
        'What skills did you develop?',
        'How did that job shape your career?',
        'What would you tell young people starting their first job?'
      ]),
      tags: JSON.stringify(['work', 'first-job', 'learning']),
      is_library_prompt: true,
      template_id: 'career_001',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'What was your proudest moment in your career?',
      category: 'career',
      difficulty: 'medium',
      follow_up_questions: JSON.stringify([
        'What did you learn from that experience?',
        'How did others react to your achievement?',
        'What advice would you give to someone in that situation?'
      ]),
      tags: JSON.stringify(['achievement', 'pride', 'success']),
      is_library_prompt: true,
      template_id: 'career_002',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'What did you want to be when you grew up?',
      category: 'career',
      difficulty: 'easy',
      follow_up_questions: JSON.stringify([
        'Did you achieve that dream?',
        'What influenced that choice?',
        'How did your actual career compare?'
      ]),
      tags: JSON.stringify(['dreams', 'childhood', 'aspirations']),
      is_library_prompt: true,
      template_id: 'career_003',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },

    // Relationship prompts
    {
      id: uuidv4(),
      text: 'Tell me about your best friend growing up.',
      category: 'relationships',
      difficulty: 'easy',
      follow_up_questions: JSON.stringify([
        'Are you still in touch with them?',
        'What made that friendship special?',
        'How did you meet?'
      ]),
      tags: JSON.stringify(['friendship', 'childhood', 'people']),
      is_library_prompt: true,
      template_id: 'relationships_001',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'How did you meet your spouse/partner?',
      category: 'relationships',
      difficulty: 'medium',
      follow_up_questions: JSON.stringify([
        'What was going through your mind that day?',
        'How did your families react?',
        'What attracted you to them?'
      ]),
      tags: JSON.stringify(['love', 'marriage', 'meeting']),
      is_library_prompt: true,
      template_id: 'relationships_002',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'What was your wedding day like?',
      category: 'relationships',
      difficulty: 'medium',
      follow_up_questions: JSON.stringify([
        'What was the most memorable moment?',
        'Did everything go as planned?',
        'What advice would you give to newlyweds?'
      ]),
      tags: JSON.stringify(['wedding', 'celebration', 'love']),
      is_library_prompt: true,
      template_id: 'relationships_003',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },

    // General life prompts
    {
      id: uuidv4(),
      text: 'What is the most important lesson life has taught you?',
      category: 'general',
      difficulty: 'medium',
      follow_up_questions: JSON.stringify([
        'How did you come to realize this?',
        'When did you learn this lesson?',
        'How has this shaped who you are?'
      ]),
      tags: JSON.stringify(['wisdom', 'learning', 'life-lessons']),
      is_library_prompt: true,
      template_id: 'general_001',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'If you could give your younger self one piece of advice, what would it be?',
      category: 'general',
      difficulty: 'medium',
      follow_up_questions: JSON.stringify([
        'What would have been different?',
        'When did you realize this?',
        'What would you want young people to know?'
      ]),
      tags: JSON.stringify(['advice', 'wisdom', 'reflection']),
      is_library_prompt: true,
      template_id: 'general_002',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'What are you most grateful for in your life?',
      category: 'general',
      difficulty: 'easy',
      follow_up_questions: JSON.stringify([
        'When did you realize how important this was?',
        'How has this impacted your life?',
        'What would you tell others about gratitude?'
      ]),
      tags: JSON.stringify(['gratitude', 'appreciation', 'reflection']),
      is_library_prompt: true,
      template_id: 'general_003',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'Tell me about a time when you had to be brave.',
      category: 'general',
      difficulty: 'hard',
      follow_up_questions: JSON.stringify([
        'What gave you the courage?',
        'How did you feel afterwards?',
        'What did you learn about yourself?'
      ]),
      tags: JSON.stringify(['courage', 'bravery', 'challenge']),
      is_library_prompt: true,
      template_id: 'general_004',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      text: 'What major historical event do you remember most clearly?',
      category: 'general',
      difficulty: 'hard',
      follow_up_questions: JSON.stringify([
        'How did people around you react?',
        'What was different about life before and after?',
        'What did you think would happen next?'
      ]),
      tags: JSON.stringify(['history', 'events', 'memory']),
      is_library_prompt: true,
      template_id: 'general_005',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ];

  await knex('prompts').insert(libraryPrompts);
};