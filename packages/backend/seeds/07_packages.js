/**
 * Seed data for packages table
 * Defines the available resource packages with pricing in the $99-149 range
 */

exports.seed = async function(knex) {
  // Delete existing entries
  await knex('packages').del()

  // Insert package definitions
  await knex('packages').insert([
    {
      id: 'saga-package-v1',
      name: 'The Saga Package',
      description: 'Complete family storytelling package with 1 project voucher, 2 facilitator seats, and 2 storyteller seats. Includes 1 year of interactive service and permanent archival access.',
      price: 99.00,
      currency: 'USD',
      project_vouchers: 1,
      facilitator_seats: 2,
      storyteller_seats: 2,
      features: JSON.stringify([
        '1 Project Voucher',
        '2 Facilitator Seats (for sibling collaboration)',
        '2 Storyteller Seats (for multiple family members)',
        '1 year of interactive service',
        'Permanent archival mode access',
        'Full data export capability',
        'AI-powered prompts and chapter summaries',
        'Cross-platform access (web and mobile)',
        'Email support'
      ]),
      is_active: true,
      sort_order: 1,
      stripe_product_id: null, // To be set when Stripe products are created
      stripe_price_id: null,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'saga-package-premium',
      name: 'The Saga Premium Package',
      description: 'Premium family storytelling package with 3 project vouchers, 4 facilitator seats, and 4 storyteller seats. Perfect for larger families with extended storytelling needs.',
      price: 149.00,
      currency: 'USD',
      project_vouchers: 3,
      facilitator_seats: 4,
      storyteller_seats: 4,
      features: JSON.stringify([
        '3 Project Vouchers',
        '4 Facilitator Seats (for multiple siblings)',
        '4 Storyteller Seats (for extended family)',
        '1 year of interactive service',
        'Permanent archival mode access',
        'Full data export capability',
        'AI-powered prompts and chapter summaries',
        'Cross-platform access (web and mobile)',
        'Priority customer support',
        'Early access to new features',
        'Advanced analytics and insights',
        'Custom branding options'
      ]),
      is_active: true,
      sort_order: 2,
      stripe_product_id: null, // To be set when Stripe products are created
      stripe_price_id: null,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'saga-package-starter',
      name: 'The Saga Starter Package',
      description: 'Entry-level package for small families just getting started with their storytelling journey.',
      price: 79.00,
      currency: 'USD',
      project_vouchers: 1,
      facilitator_seats: 1,
      storyteller_seats: 1,
      features: JSON.stringify([
        '1 Project Voucher',
        '1 Facilitator Seat',
        '1 Storyteller Seat',
        '6 months of interactive service',
        'Permanent archival mode access',
        'Basic data export',
        'AI-powered prompts',
        'Cross-platform access (web and mobile)',
        'Community support'
      ]),
      is_active: false, // Disabled by default - can be enabled later
      sort_order: 0,
      stripe_product_id: null,
      stripe_price_id: null,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'saga-package-enterprise',
      name: 'The Saga Enterprise Package',
      description: 'Enterprise package for organizations, large families, or professional storytellers with extensive needs.',
      price: 299.00,
      currency: 'USD',
      project_vouchers: 10,
      facilitator_seats: 10,
      storyteller_seats: 20,
      features: JSON.stringify([
        '10 Project Vouchers',
        '10 Facilitator Seats',
        '20 Storyteller Seats',
        '2 years of interactive service',
        'Permanent archival mode access',
        'Advanced data export and analytics',
        'AI-powered prompts and chapter summaries',
        'Cross-platform access (web and mobile)',
        'Dedicated customer success manager',
        'Priority feature requests',
        'Custom integrations',
        'White-label options',
        'Advanced security features',
        'Bulk user management'
      ]),
      is_active: false, // Disabled by default - for future use
      sort_order: 3,
      stripe_product_id: null,
      stripe_price_id: null,
      created_at: new Date(),
      updated_at: new Date()
    }
  ])
}