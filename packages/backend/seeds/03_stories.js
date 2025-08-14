/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Insert sample stories
  const stories = await knex('stories').insert([
    {
      id: '770e8400-e29b-41d4-a716-446655440001',
      project_id: '660e8400-e29b-41d4-a716-446655440001',
      title: 'My Childhood in the 1950s',
      audio_url: 'https://example.com/audio/story1.mp3',
      audio_duration: 180,
      transcript: 'I remember growing up in the 1950s was such a different time. We didn\'t have all the technology we have today, but we had something special - a real sense of community. Every morning, I would wake up to the sound of the milkman delivering fresh milk to our doorstep...',
      original_transcript: 'I remember growing up in the 1950s was such a different time. We didn\'t have all the technology we have today, but we had something special - a real sense of community. Every morning, I would wake up to the sound of the milkman delivering fresh milk to our doorstep...',
      ai_prompt: 'Tell me about your childhood memories and what life was like when you were growing up.',
      status: 'ready',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440002',
      project_id: '660e8400-e29b-41d4-a716-446655440001',
      title: 'Meeting Your Father',
      audio_url: 'https://example.com/audio/story2.mp3',
      audio_duration: 240,
      transcript: 'I met your father at a dance in 1962. He was wearing a blue suit and had the most charming smile. I was with my girlfriends, and we were all trying to work up the courage to dance. When he asked me to dance, I thought my heart would stop...',
      original_transcript: 'I met your father at a dance in 1962. He was wearing a blue suit and had the most charming smile. I was with my girlfriends, and we were all trying to work up the courage to dance. When he asked me to dance, I thought my heart would stop...',
      ai_prompt: 'Can you tell me about how you met your spouse? What was that experience like?',
      status: 'ready',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440003',
      project_id: '660e8400-e29b-41d4-a716-446655440002',
      title: 'My First Job',
      audio_url: 'https://example.com/audio/story3.mp3',
      audio_duration: 195,
      transcript: 'My first real job was at the local hardware store when I was 16. Mr. Johnson, the owner, was a tough but fair man. He taught me the value of hard work and treating customers with respect. I remember my first day, I was so nervous...',
      original_transcript: 'My first real job was at the local hardware store when I was 16. Mr. Johnson, the owner, was a tough but fair man. He taught me the value of hard work and treating customers with respect. I remember my first day, I was so nervous...',
      ai_prompt: 'What was your first job like? Can you tell me about that experience?',
      status: 'ready',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440004',
      project_id: '660e8400-e29b-41d4-a716-446655440001',
      title: 'Family Traditions',
      audio_url: 'https://example.com/audio/story4.mp3',
      audio_duration: 0,
      ai_prompt: 'What family traditions were important to you growing up, and which ones did you pass on to your children?',
      status: 'processing',
      created_at: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
  ]).returning('*')

  console.log('✅ Seeded stories:', stories.length)
}