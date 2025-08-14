/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Insert projects
  const projects = await knex('projects').insert([
    {
      id: '660e8400-e29b-41d4-a716-446655440001',
      name: "Mom's Life Story",
      facilitator_id: '550e8400-e29b-41d4-a716-446655440001',
      storyteller_id: '550e8400-e29b-41d4-a716-446655440002',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440002',
      name: "Dad's Adventures",
      facilitator_id: '550e8400-e29b-41d4-a716-446655440003',
      storyteller_id: '550e8400-e29b-41d4-a716-446655440004',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440003',
      name: "Grandma's Memories",
      facilitator_id: '550e8400-e29b-41d4-a716-446655440001',
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]).returning('*')
  
  // Insert corresponding subscriptions for active projects
  await knex('subscriptions').insert([
    {
      id: '770e8400-e29b-41d4-a716-446655440001',
      facilitator_id: '550e8400-e29b-41d4-a716-446655440001',
      status: 'active',
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440002',
      facilitator_id: '550e8400-e29b-41d4-a716-446655440003',
      status: 'active',
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      created_at: new Date(),
      updated_at: new Date(),
    },
  ])

  // Insert user roles
  await knex('user_roles').insert([
    {
      user_id: '550e8400-e29b-41d4-a716-446655440001',
      type: 'facilitator',
      project_id: '660e8400-e29b-41d4-a716-446655440001',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      type: 'storyteller',
      project_id: '660e8400-e29b-41d4-a716-446655440001',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440003',
      type: 'facilitator',
      project_id: '660e8400-e29b-41d4-a716-446655440002',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440004',
      type: 'storyteller',
      project_id: '660e8400-e29b-41d4-a716-446655440002',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440001',
      type: 'facilitator',
      project_id: '660e8400-e29b-41d4-a716-446655440003',
      created_at: new Date(),
      updated_at: new Date(),
    },
  ])

  // Insert user resource wallets for v1.5 (with conflict handling)
  const walletData = [
    {
      user_id: '550e8400-e29b-41d4-a716-446655440001',
      project_vouchers: 2,
      facilitator_seats: 3,
      storyteller_seats: 2,
      updated_at: new Date(),
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      project_vouchers: 0,
      facilitator_seats: 0,
      storyteller_seats: 0,
      updated_at: new Date(),
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440003',
      project_vouchers: 1,
      facilitator_seats: 2,
      storyteller_seats: 1,
      updated_at: new Date(),
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440004',
      project_vouchers: 0,
      facilitator_seats: 0,
      storyteller_seats: 0,
      updated_at: new Date(),
    },
  ]

  // Insert wallets with conflict handling
  for (const wallet of walletData) {
    await knex('user_resource_wallets')
      .insert(wallet)
      .onConflict('user_id')
      .merge(['project_vouchers', 'facilitator_seats', 'storyteller_seats', 'updated_at'])
  }

  // Insert project roles for v1.5 (replacing user_roles)
  await knex('project_roles').insert([
    {
      id: '880e8400-e29b-41d4-a716-446655440001',
      project_id: '660e8400-e29b-41d4-a716-446655440001',
      user_id: '550e8400-e29b-41d4-a716-446655440001',
      role: 'facilitator',
      created_at: new Date(),
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440002',
      project_id: '660e8400-e29b-41d4-a716-446655440001',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      role: 'storyteller',
      created_at: new Date(),
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440003',
      project_id: '660e8400-e29b-41d4-a716-446655440002',
      user_id: '550e8400-e29b-41d4-a716-446655440003',
      role: 'facilitator',
      created_at: new Date(),
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440004',
      project_id: '660e8400-e29b-41d4-a716-446655440002',
      user_id: '550e8400-e29b-41d4-a716-446655440004',
      role: 'storyteller',
      created_at: new Date(),
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440005',
      project_id: '660e8400-e29b-41d4-a716-446655440003',
      user_id: '550e8400-e29b-41d4-a716-446655440001',
      role: 'facilitator',
      created_at: new Date(),
    },
  ])

  console.log('✅ Seeded projects:', projects.length)
}