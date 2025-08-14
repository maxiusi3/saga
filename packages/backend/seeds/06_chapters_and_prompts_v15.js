/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('prompts').del();
  await knex('chapters').del();
  
  // Insert chapters for v1.5 MVP
  const chapters = [
    {
      id: '990e8400-e29b-41d4-a716-446655440001',
      name: 'Early Life & Childhood',
      description: 'Stories about early memories, childhood experiences, and formative years',
      order_index: 1,
      is_active: true
    },
    {
      id: '990e8400-e29b-41d4-a716-446655440002',
      name: 'Family & Relationships',
      description: 'Stories about family members, friendships, and important relationships',
      order_index: 2,
      is_active: true
    },
    {
      id: '990e8400-e29b-41d4-a716-446655440003',
      name: 'Education & Career',
      description: 'Stories about school, work, career achievements, and professional life',
      order_index: 3,
      is_active: true
    },
    {
      id: '990e8400-e29b-41d4-a716-446655440004',
      name: 'Life Lessons & Wisdom',
      description: 'Stories about important lessons learned, advice, and wisdom gained',
      order_index: 4,
      is_active: true
    },
    {
      id: '990e8400-e29b-41d4-a716-446655440005',
      name: 'Traditions & Celebrations',
      description: 'Stories about family traditions, holidays, celebrations, and special occasions',
      order_index: 5,
      is_active: true
    },
    {
      id: '990e8400-e29b-41d4-a716-446655440006',
      name: 'Adventures & Travel',
      description: 'Stories about travels, adventures, and memorable experiences',
      order_index: 6,
      is_active: true
    },
    {
      id: '990e8400-e29b-41d4-a716-446655440007',
      name: 'Legacy & Future',
      description: 'Stories about hopes for the future, legacy, and messages for future generations',
      order_index: 7,
      is_active: true
    }
  ];
  
  await knex('chapters').insert(chapters);
  
  // Get inserted chapters
  const insertedChapters = await knex('chapters').select('*').orderBy('order_index');
  
  // Sample prompts for each chapter (10-12 prompts per chapter for ~75 total)
  const prompts = [];
  
  // Early Life & Childhood prompts
  const earlyLifeChapter = insertedChapters.find(c => c.order_index === 1);
  prompts.push(
    { chapter_id: earlyLifeChapter.id, text: "What is your earliest childhood memory?", order_index: 1 },
    { chapter_id: earlyLifeChapter.id, text: "Tell me about the house you grew up in.", order_index: 2 },
    { chapter_id: earlyLifeChapter.id, text: "What was your favorite toy or game as a child?", order_index: 3 },
    { chapter_id: earlyLifeChapter.id, text: "Describe a typical day when you were 8 years old.", order_index: 4 },
    { chapter_id: earlyLifeChapter.id, text: "What did you want to be when you grew up?", order_index: 5 },
    { chapter_id: earlyLifeChapter.id, text: "Tell me about your childhood best friend.", order_index: 6 },
    { chapter_id: earlyLifeChapter.id, text: "What was your favorite family meal growing up?", order_index: 7 },
    { chapter_id: earlyLifeChapter.id, text: "Describe a childhood adventure or mischief you got into.", order_index: 8 },
    { chapter_id: earlyLifeChapter.id, text: "What was your favorite place to play as a child?", order_index: 9 },
    { chapter_id: earlyLifeChapter.id, text: "Tell me about a childhood fear you had.", order_index: 10 }
  );
  
  // Family & Relationships prompts
  const familyChapter = insertedChapters.find(c => c.order_index === 2);
  prompts.push(
    { chapter_id: familyChapter.id, text: "Tell me about your parents. What were they like?", order_index: 1 },
    { chapter_id: familyChapter.id, text: "Describe your relationship with your siblings.", order_index: 2 },
    { chapter_id: familyChapter.id, text: "Tell me about your grandparents.", order_index: 3 },
    { chapter_id: familyChapter.id, text: "How did you meet your spouse or life partner?", order_index: 4 },
    { chapter_id: familyChapter.id, text: "What was your wedding day like?", order_index: 5 },
    { chapter_id: familyChapter.id, text: "Tell me about becoming a parent for the first time.", order_index: 6 },
    { chapter_id: familyChapter.id, text: "Describe a family tradition that was important to you.", order_index: 7 },
    { chapter_id: familyChapter.id, text: "Tell me about a family member who influenced you greatly.", order_index: 8 },
    { chapter_id: familyChapter.id, text: "What was the best advice your parents gave you?", order_index: 9 },
    { chapter_id: familyChapter.id, text: "Describe a memorable family gathering or reunion.", order_index: 10 },
    { chapter_id: familyChapter.id, text: "Tell me about a friend who became like family.", order_index: 11 }
  );
  
  // Education & Career prompts
  const careerChapter = insertedChapters.find(c => c.order_index === 3);
  prompts.push(
    { chapter_id: careerChapter.id, text: "What was your favorite subject in school?", order_index: 1 },
    { chapter_id: careerChapter.id, text: "Tell me about a teacher who made a difference in your life.", order_index: 2 },
    { chapter_id: careerChapter.id, text: "Describe your first job.", order_index: 3 },
    { chapter_id: careerChapter.id, text: "What was your proudest professional achievement?", order_index: 4 },
    { chapter_id: careerChapter.id, text: "Tell me about a challenge you overcame at work.", order_index: 5 },
    { chapter_id: careerChapter.id, text: "Describe a mentor who helped shape your career.", order_index: 6 },
    { chapter_id: careerChapter.id, text: "What did you enjoy most about your work?", order_index: 7 },
    { chapter_id: careerChapter.id, text: "Tell me about a time you had to make a difficult decision at work.", order_index: 8 },
    { chapter_id: careerChapter.id, text: "What skills did you develop that you're most proud of?", order_index: 9 },
    { chapter_id: careerChapter.id, text: "Describe your retirement or career transition.", order_index: 10 }
  );
  
  // Life Lessons & Wisdom prompts
  const wisdomChapter = insertedChapters.find(c => c.order_index === 4);
  prompts.push(
    { chapter_id: wisdomChapter.id, text: "What's the most important lesson life has taught you?", order_index: 1 },
    { chapter_id: wisdomChapter.id, text: "Tell me about a mistake that taught you something valuable.", order_index: 2 },
    { chapter_id: wisdomChapter.id, text: "What advice would you give to your younger self?", order_index: 3 },
    { chapter_id: wisdomChapter.id, text: "Describe a time when you had to be brave.", order_index: 4 },
    { chapter_id: wisdomChapter.id, text: "What does success mean to you?", order_index: 5 },
    { chapter_id: wisdomChapter.id, text: "Tell me about a time you helped someone in need.", order_index: 6 },
    { chapter_id: wisdomChapter.id, text: "What's something you wish you had done differently?", order_index: 7 },
    { chapter_id: wisdomChapter.id, text: "Describe a moment when you felt truly proud of yourself.", order_index: 8 },
    { chapter_id: wisdomChapter.id, text: "What values are most important to you?", order_index: 9 },
    { chapter_id: wisdomChapter.id, text: "Tell me about overcoming a difficult period in your life.", order_index: 10 },
    { chapter_id: wisdomChapter.id, text: "What keeps you motivated and positive?", order_index: 11 }
  );
  
  // Traditions & Celebrations prompts
  const traditionsChapter = insertedChapters.find(c => c.order_index === 5);
  prompts.push(
    { chapter_id: traditionsChapter.id, text: "Tell me about your favorite holiday tradition.", order_index: 1 },
    { chapter_id: traditionsChapter.id, text: "Describe a memorable birthday celebration.", order_index: 2 },
    { chapter_id: traditionsChapter.id, text: "What family recipes or cooking traditions do you cherish?", order_index: 3 },
    { chapter_id: traditionsChapter.id, text: "Tell me about a cultural or religious tradition that's important to you.", order_index: 4 },
    { chapter_id: traditionsChapter.id, text: "Describe your family's New Year's traditions.", order_index: 5 },
    { chapter_id: traditionsChapter.id, text: "Tell me about a special anniversary or milestone celebration.", order_index: 6 },
    { chapter_id: traditionsChapter.id, text: "What traditions did you start with your own family?", order_index: 7 },
    { chapter_id: traditionsChapter.id, text: "Describe a memorable graduation or achievement celebration.", order_index: 8 },
    { chapter_id: traditionsChapter.id, text: "Tell me about holiday decorations or preparations you enjoyed.", order_index: 9 },
    { chapter_id: traditionsChapter.id, text: "What seasonal activities or traditions do you look forward to?", order_index: 10 }
  );
  
  // Adventures & Travel prompts
  const adventuresChapter = insertedChapters.find(c => c.order_index === 6);
  prompts.push(
    { chapter_id: adventuresChapter.id, text: "Tell me about your most memorable trip or vacation.", order_index: 1 },
    { chapter_id: adventuresChapter.id, text: "Describe an adventure that pushed you out of your comfort zone.", order_index: 2 },
    { chapter_id: adventuresChapter.id, text: "What's the most beautiful place you've ever visited?", order_index: 3 },
    { chapter_id: adventuresChapter.id, text: "Tell me about a time you got lost or had an unexpected detour.", order_index: 4 },
    { chapter_id: adventuresChapter.id, text: "Describe a camping or outdoor adventure you enjoyed.", order_index: 5 },
    { chapter_id: adventuresChapter.id, text: "What's the farthest from home you've ever traveled?", order_index: 6 },
    { chapter_id: adventuresChapter.id, text: "Tell me about meeting interesting people during your travels.", order_index: 7 },
    { chapter_id: adventuresChapter.id, text: "Describe a local adventure or exploration in your hometown.", order_index: 8 },
    { chapter_id: adventuresChapter.id, text: "What's the most spontaneous thing you've ever done?", order_index: 9 },
    { chapter_id: adventuresChapter.id, text: "Tell me about a travel experience that changed your perspective.", order_index: 10 }
  );
  
  // Legacy & Future prompts
  const legacyChapter = insertedChapters.find(c => c.order_index === 7);
  prompts.push(
    { chapter_id: legacyChapter.id, text: "What do you hope to be remembered for?", order_index: 1 },
    { chapter_id: legacyChapter.id, text: "What advice do you want to pass on to future generations?", order_index: 2 },
    { chapter_id: legacyChapter.id, text: "Tell me about something you've created or built that you're proud of.", order_index: 3 },
    { chapter_id: legacyChapter.id, text: "What changes have you seen in the world during your lifetime?", order_index: 4 },
    { chapter_id: legacyChapter.id, text: "What are your hopes for your children and grandchildren?", order_index: 5 },
    { chapter_id: legacyChapter.id, text: "Describe a cause or belief that's important to you.", order_index: 6 },
    { chapter_id: legacyChapter.id, text: "What would you like people to know about your generation?", order_index: 7 },
    { chapter_id: legacyChapter.id, text: "Tell me about a tradition you hope will continue in your family.", order_index: 8 },
    { chapter_id: legacyChapter.id, text: "What message would you leave for someone facing similar challenges you've faced?", order_index: 9 },
    { chapter_id: legacyChapter.id, text: "How do you want your story to inspire others?", order_index: 10 }
  );
  
  // Insert all prompts
  await knex('prompts').insert(prompts.map(prompt => ({
    ...prompt,
    category: 'general', // Default category for v1.5 prompts
    difficulty: 'medium', // Default difficulty
    is_active: true,
    created_at: knex.fn.now()
  })));
  
  console.log(`Seeded ${chapters.length} chapters and ${prompts.length} prompts for v1.5 MVP`);
};