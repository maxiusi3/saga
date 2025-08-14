/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('projects', function(table) {
    table.string('id', 36).primary()
    table.string('name', 255).notNullable()
    table.string('facilitator_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('storyteller_id', 36).references('id').inTable('users').onDelete('SET NULL')
    table.string('status', 20).defaultTo('pending')
    table.timestamp('subscription_expires_at')
    table.timestamps(true, true)
    
    // Indexes
    table.index(['facilitator_id'])
    table.index(['storyteller_id'])
    table.index(['status'])
    table.index(['subscription_expires_at'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('projects')
}