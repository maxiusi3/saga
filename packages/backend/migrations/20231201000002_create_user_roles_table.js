/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_roles', function(table) {
    table.string('id', 36).primary()
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('type', 20).notNullable()
    table.string('project_id', 36) // Will add foreign key constraint later
    table.timestamps(true, true)
    
    // Indexes
    table.index(['user_id'])
    table.index(['project_id'])
    table.index(['user_id', 'type'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('user_roles')
}