/**
 * Create packages table for managing resource packages and pricing
 */

exports.up = function(knex) {
  return knex.schema.createTable('packages', function(table) {
    table.string('id').primary()
    table.string('name').notNullable()
    table.text('description').notNullable()
    table.decimal('price', 10, 2).notNullable()
    table.string('currency', 3).notNullable().defaultTo('USD')
    
    // Resource allocation
    table.integer('project_vouchers').notNullable().defaultTo(0)
    table.integer('facilitator_seats').notNullable().defaultTo(0)
    table.integer('storyteller_seats').notNullable().defaultTo(0)
    
    // Features as JSON array
    table.json('features').notNullable().defaultTo('[]')
    
    // Status and ordering
    table.boolean('is_active').notNullable().defaultTo(true)
    table.integer('sort_order').notNullable().defaultTo(0)
    
    // Stripe integration
    table.string('stripe_product_id').nullable()
    table.string('stripe_price_id').nullable()
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
    
    // Indexes
    table.index(['is_active', 'sort_order'])
    table.index('stripe_product_id')
    table.index('price')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('packages')
}