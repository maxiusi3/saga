/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('invitations', function(table) {
    table.string('id', 36).primary()
    table.string('project_id', 36).notNullable().references('id').inTable('projects').onDelete('CASCADE')
    table.string('token', 255).unique().notNullable()
    table.timestamp('expires_at').notNullable()
    table.timestamp('used_at')
    table.timestamps(true, true)
    
    // Indexes
    table.index(['project_id'])
    table.index(['token'])
    table.index(['expires_at'])
    table.index(['used_at'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('invitations')
}