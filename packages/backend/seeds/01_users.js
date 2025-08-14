const bcrypt = require('bcryptjs')

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('export_requests').del()
  await knex('interactions').del()
  await knex('stories').del()
  await knex('invitations').del()
  await knex('subscriptions').del()
  await knex('user_roles').del()
  await knex('projects').del()
  await knex('users').del()

  // Hash passwords
  const passwordHash = await bcrypt.hash('password123', 12)

  // Insert seed entries
  const users = await knex('users').insert([
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'John Facilitator',
      email: 'john@example.com',
      password_hash: passwordHash,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Mary Storyteller',
      email: 'mary@example.com',
      password_hash: passwordHash,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Bob Facilitator',
      email: 'bob@example.com',
      password_hash: passwordHash,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      name: 'Alice Storyteller',
      phone: '+1234567890',
      password_hash: passwordHash,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]).returning('*')

  console.log('✅ Seeded users:', users.length)
}