/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('subscriptions', function(table) {
    table.uuid('plan_id').references('id').inTable('subscription_plans').onDelete('SET NULL')
    table.jsonb('metadata')
    
    // Add index for plan_id
    table.index('plan_id')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('subscriptions', function(table) {
    table.dropColumn('plan_id')
    table.dropColumn('metadata')
  })
}