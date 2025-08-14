/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('export_requests', function(table) {
    table.string('id', 36).primary()
    table.string('project_id', 36).notNullable().references('id').inTable('projects').onDelete('CASCADE')
    table.string('facilitator_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('status', 20).defaultTo('pending')
    table.string('download_url', 500)
    table.timestamp('expires_at')
    table.timestamps(true, true)
    
    // Indexes
    table.index(['project_id'])
    table.index(['facilitator_id'])
    table.index(['status'])
    table.index(['expires_at'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('export_requests')
}