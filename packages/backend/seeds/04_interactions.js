/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Insert sample interactions
  const interactions = await knex('interactions').insert([
    {
      story_id: '770e8400-e29b-41d4-a716-446655440001',
      facilitator_id: '550e8400-e29b-41d4-a716-446655440001',
      type: 'comment',
      content: 'This is such a beautiful memory, Mom! I love hearing about the milkman and how different things were back then.',
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      updated_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
    {
      story_id: '770e8400-e29b-41d4-a716-446655440001',
      facilitator_id: '550e8400-e29b-41d4-a716-446655440001',
      type: 'followup',
      content: 'Can you tell me more about the neighborhood you grew up in? What were your neighbors like?',
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      updated_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
    {
      story_id: '770e8400-e29b-41d4-a716-446655440002',
      facilitator_id: '550e8400-e29b-41d4-a716-446655440001',
      type: 'comment',
      content: 'I never knew Dad wore a blue suit when you first met! That\'s so sweet. Do you still have any photos from that dance?',
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      story_id: '770e8400-e29b-41d4-a716-446655440002',
      facilitator_id: '550e8400-e29b-41d4-a716-446655440001',
      type: 'followup',
      content: 'What was your first impression of Dad? Did you know right away that he was special?',
      answered_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Answered 3 days ago
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      story_id: '770e8400-e29b-41d4-a716-446655440003',
      facilitator_id: '550e8400-e29b-41d4-a716-446655440003',
      type: 'comment',
      content: 'Mr. Johnson sounds like he was a great mentor, Dad. It\'s amazing how those early job experiences shape us.',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      story_id: '770e8400-e29b-41d4-a716-446655440003',
      facilitator_id: '550e8400-e29b-41d4-a716-446655440003',
      type: 'followup',
      content: 'What was the most important lesson Mr. Johnson taught you that you still use today?',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  ]).returning('*')

  console.log('✅ Seeded interactions:', interactions.length)
}