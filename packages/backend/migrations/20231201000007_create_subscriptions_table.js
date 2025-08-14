/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('subscriptions', function(table) {
    table.string('id', 36).primary()
    table.string('facilitator_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('stripe_subscription_id', 255)
    table.string('status', 20).notNullable()
    table.timestamp('current_period_start')
    table.timestamp('current_period_end')
    table.timestamps(true, true)
    
    // Indexes
    table.index(['facilitator_id'])
    table.index(['stripe_subscription_id'])
    table.index(['status'])
    table.index(['current_period_end'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('subscriptions')
}