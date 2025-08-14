/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('interactions', function(table) {
    table.string('id', 36).primary()
    table.string('story_id', 36).notNullable().references('id').inTable('stories').onDelete('CASCADE')
    table.string('facilitator_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('type', 20).notNullable()
    table.text('content').notNullable()
    table.timestamp('answered_at')
    table.timestamps(true, true)
    
    // Indexes
    table.index(['story_id'])
    table.index(['facilitator_id'])
    table.index(['type'])
    table.index(['answered_at'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('interactions')
}