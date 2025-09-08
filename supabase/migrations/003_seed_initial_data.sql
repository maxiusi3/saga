-- Seed initial data for Saga project
-- This includes chapters and prompts for the AI storytelling system

-- Insert initial chapters
INSERT INTO chapters (id, name, description, order_index, is_active) VALUES
  (uuid_generate_v4(), 'Early Life', 'Stories about childhood, family background, and formative years', 1, true),
  (uuid_generate_v4(), 'Education & Career', 'School experiences, career choices, and professional journey', 2, true),
  (uuid_generate_v4(), 'Relationships', 'Family, friends, romantic relationships, and important connections', 3, true),
  (uuid_generate_v4(), 'Major Life Events', 'Significant moments, challenges, and turning points', 4, true),
  (uuid_generate_v4(), 'Wisdom & Reflections', 'Life lessons, advice, and reflections on experiences', 5, true),
  (uuid_generate_v4(), 'Legacy & Future', 'Hopes for the future and what you want to be remembered for', 6, true)
ON CONFLICT (id) DO NOTHING;

-- Get chapter IDs for prompt insertion
DO $$
DECLARE
  early_life_id UUID;
  education_career_id UUID;
  relationships_id UUID;
  major_events_id UUID;
  wisdom_id UUID;
  legacy_id UUID;
BEGIN
  -- Get chapter IDs
  SELECT id INTO early_life_id FROM chapters WHERE name = 'Early Life';
  SELECT id INTO education_career_id FROM chapters WHERE name = 'Education & Career';
  SELECT id INTO relationships_id FROM chapters WHERE name = 'Relationships';
  SELECT id INTO major_events_id FROM chapters WHERE name = 'Major Life Events';
  SELECT id INTO wisdom_id FROM chapters WHERE name = 'Wisdom & Reflections';
  SELECT id INTO legacy_id FROM chapters WHERE name = 'Legacy & Future';

  -- Insert prompts for Early Life
  INSERT INTO prompts (chapter_id, text, order_index, is_active) VALUES
    (early_life_id, 'Tell me about where you were born and what your childhood home was like.', 1, true),
    (early_life_id, 'What are your earliest memories? What stands out most from your early years?', 2, true),
    (early_life_id, 'Describe your parents and what they were like when you were growing up.', 3, true),
    (early_life_id, 'Did you have any siblings? What was your relationship with them like?', 4, true),
    (early_life_id, 'What family traditions or customs were important in your household?', 5, true),
    (early_life_id, 'Tell me about your neighborhood and the community you grew up in.', 6, true),
    (early_life_id, 'What were your favorite games, toys, or activities as a child?', 7, true),
    (early_life_id, 'Do you remember any particularly happy or difficult moments from your childhood?', 8, true);

  -- Insert prompts for Education & Career
  INSERT INTO prompts (chapter_id, text, order_index, is_active) VALUES
    (education_career_id, 'Tell me about your school experience. What subjects did you enjoy most?', 1, true),
    (education_career_id, 'Who were your favorite teachers and why did they make an impact on you?', 2, true),
    (education_career_id, 'What did you want to be when you grew up? How did those dreams change over time?', 3, true),
    (education_career_id, 'Describe your first job. What was it like and what did you learn?', 4, true),
    (education_career_id, 'How did you choose your career path? What influenced your decisions?', 5, true),
    (education_career_id, 'Tell me about a mentor or colleague who had a significant impact on your professional life.', 6, true),
    (education_career_id, 'What achievements in your career are you most proud of?', 7, true),
    (education_career_id, 'Were there any major career changes or challenges you faced?', 8, true);

  -- Insert prompts for Relationships
  INSERT INTO prompts (chapter_id, text, order_index, is_active) VALUES
    (relationships_id, 'Tell me about your closest childhood friends. Are you still in touch with any of them?', 1, true),
    (relationships_id, 'How did you meet your spouse/partner? What attracted you to them?', 2, true),
    (relationships_id, 'Describe your wedding day or the day you committed to your partner.', 3, true),
    (relationships_id, 'Tell me about becoming a parent. How did it change your life?', 4, true),
    (relationships_id, 'What kind of parent did you try to be? What values did you want to pass on?', 5, true),
    (relationships_id, 'Who has been your closest friend throughout your life and why?', 6, true),
    (relationships_id, 'Tell me about a relationship that taught you something important about yourself.', 7, true),
    (relationships_id, 'How has your family grown and changed over the years?', 8, true);

  -- Insert prompts for Major Life Events
  INSERT INTO prompts (chapter_id, text, order_index, is_active) VALUES
    (major_events_id, 'What was the happiest day of your life? Tell me about it.', 1, true),
    (major_events_id, 'Describe a time when you faced a significant challenge. How did you overcome it?', 2, true),
    (major_events_id, 'Tell me about a moment when you felt most proud of yourself.', 3, true),
    (major_events_id, 'Was there a time when you had to make a difficult decision? What was it and how did you decide?', 4, true),
    (major_events_id, 'Describe a loss or difficult period in your life and how you got through it.', 5, true),
    (major_events_id, 'Tell me about a time when you took a big risk. What happened?', 6, true),
    (major_events_id, 'What moment or event changed the course of your life?', 7, true),
    (major_events_id, 'Describe a time when you surprised yourself with what you were capable of.', 8, true);

  -- Insert prompts for Wisdom & Reflections
  INSERT INTO prompts (chapter_id, text, order_index, is_active) VALUES
    (wisdom_id, 'What is the most important lesson life has taught you?', 1, true),
    (wisdom_id, 'If you could give advice to your younger self, what would you say?', 2, true),
    (wisdom_id, 'What do you know now that you wish you had known when you were younger?', 3, true),
    (wisdom_id, 'What are you most grateful for in your life?', 4, true),
    (wisdom_id, 'How have you changed as a person over the years?', 5, true),
    (wisdom_id, 'What values have guided you throughout your life?', 6, true),
    (wisdom_id, 'Tell me about a mistake you made that taught you something valuable.', 7, true),
    (wisdom_id, 'What would you want your children or grandchildren to know about living a good life?', 8, true);

  -- Insert prompts for Legacy & Future
  INSERT INTO prompts (chapter_id, text, order_index, is_active) VALUES
    (legacy_id, 'What do you hope to be remembered for?', 1, true),
    (legacy_id, 'What legacy do you want to leave for your family?', 2, true),
    (legacy_id, 'If you could pass on one piece of wisdom to future generations, what would it be?', 3, true),
    (legacy_id, 'What are your hopes and dreams for your children and grandchildren?', 4, true),
    (legacy_id, 'How do you want your family to remember you?', 5, true),
    (legacy_id, 'What traditions or values do you hope will continue in your family?', 6, true),
    (legacy_id, 'Is there anything you still want to accomplish or experience?', 7, true),
    (legacy_id, 'What message would you want to leave for your family to find someday?', 8, true);

END $$;
