/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('subscription_plans', function(table) {
    table.uuid('id').primary()
    table.string('name').notNullable()
    table.text('description')
    table.decimal('price', 10, 2).notNullable()
    table.enum('interval', ['month', 'year']).notNullable()
    table.string('currency', 3).defaultTo('USD')
    table.jsonb('features').notNullable()
    table.jsonb('limits').notNullable()
    table.boolean('is_active').defaultTo(true)
    table.boolean('is_popular').defaultTo(false)
    table.integer('sort_order').defaultTo(0)
    table.string('stripe_product_id')
    table.string('stripe_price_id')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // Indexes
    table.index(['is_active', 'sort_order'])
    table.index(['interval', 'is_active'])
    table.index('stripe_product_id')
    table.index('stripe_price_id')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('subscription_plans')
}