const { v4: uuidv4 } = require('uuid');

/**
 * Subscription Plans Seed Data
 */

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('subscription_plans').del()

  // Insert subscription plans
  await knex('subscription_plans').insert([
    {
      id: uuidv4(),
      name: 'Starter',
      description: 'Perfect for small families just getting started with their storytelling journey',
      price: 49.99,
      interval: 'year',
      currency: 'USD',
      features: JSON.stringify({
        projectVouchers: 1,
        facilitatorSeats: 1,
        storytellerSeats: 1,
        storageGB: 5,
        aiFeatures: true,
        prioritySupport: false,
        advancedAnalytics: false,
        customBranding: false,
        apiAccess: false
      }),
      limits: JSON.stringify({
        maxProjects: 1,
        maxStoriesPerProject: 100,
        maxFamilyMembers: 3
      }),
      is_active: true,
      is_popular: false,
      sort_order: 1,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: uuidv4(),
      name: 'Family',
      description: 'Ideal for growing families who want to capture multiple generations of stories',
      price: 99.99,
      interval: 'year',
      currency: 'USD',
      features: JSON.stringify({
        projectVouchers: 2,
        facilitatorSeats: 3,
        storytellerSeats: 3,
        storageGB: 15,
        aiFeatures: true,
        prioritySupport: true,
        advancedAnalytics: true,
        customBranding: false,
        apiAccess: false
      }),
      limits: JSON.stringify({
        maxProjects: 3,
        maxStoriesPerProject: 500,
        maxFamilyMembers: 8
      }),
      is_active: true,
      is_popular: true,
      sort_order: 2,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: uuidv4(),
      name: 'Legacy',
      description: 'For large families and professional genealogists who need unlimited storytelling power',
      price: 199.99,
      interval: 'year',
      currency: 'USD',
      features: JSON.stringify({
        projectVouchers: 5,
        facilitatorSeats: 10,
        storytellerSeats: 10,
        storageGB: 50,
        aiFeatures: true,
        prioritySupport: true,
        advancedAnalytics: true,
        customBranding: true,
        apiAccess: true
      }),
      limits: JSON.stringify({
        maxProjects: 10,
        maxStoriesPerProject: 2000,
        maxFamilyMembers: 25
      }),
      is_active: true,
      is_popular: false,
      sort_order: 3,
      created_at: new Date(),
      updated_at: new Date()
    },
    // Monthly versions
    {
      id: uuidv4(),
      name: 'Starter Monthly',
      description: 'Perfect for small families just getting started with their storytelling journey',
      price: 9.99,
      interval: 'month',
      currency: 'USD',
      features: JSON.stringify({
        projectVouchers: 1,
        facilitatorSeats: 1,
        storytellerSeats: 1,
        storageGB: 5,
        aiFeatures: true,
        prioritySupport: false,
        advancedAnalytics: false,
        customBranding: false,
        apiAccess: false
      }),
      limits: JSON.stringify({
        maxProjects: 1,
        maxStoriesPerProject: 100,
        maxFamilyMembers: 3
      }),
      is_active: true,
      is_popular: false,
      sort_order: 4,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: uuidv4(),
      name: 'Family Monthly',
      description: 'Ideal for growing families who want to capture multiple generations of stories',
      price: 19.99,
      interval: 'month',
      currency: 'USD',
      features: JSON.stringify({
        projectVouchers: 2,
        facilitatorSeats: 3,
        storytellerSeats: 3,
        storageGB: 15,
        aiFeatures: true,
        prioritySupport: true,
        advancedAnalytics: true,
        customBranding: false,
        apiAccess: false
      }),
      limits: JSON.stringify({
        maxProjects: 3,
        maxStoriesPerProject: 500,
        maxFamilyMembers: 8
      }),
      is_active: true,
      is_popular: true,
      sort_order: 5,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: uuidv4(),
      name: 'Legacy Monthly',
      description: 'For large families and professional genealogists who need unlimited storytelling power',
      price: 39.99,
      interval: 'month',
      currency: 'USD',
      features: JSON.stringify({
        projectVouchers: 5,
        facilitatorSeats: 10,
        storytellerSeats: 10,
        storageGB: 50,
        aiFeatures: true,
        prioritySupport: true,
        advancedAnalytics: true,
        customBranding: true,
        apiAccess: true
      }),
      limits: JSON.stringify({
        maxProjects: 10,
        maxStoriesPerProject: 2000,
        maxFamilyMembers: 25
      }),
      is_active: true,
      is_popular: false,
      sort_order: 6,
      created_at: new Date(),
      updated_at: new Date()
    }
  ])
}