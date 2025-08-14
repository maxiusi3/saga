/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('search_analytics', function(table) {
    table.uuid('id').primary()
    table.string('query', 255).notNullable()
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.integer('result_count').defaultTo(0)
    table.json('clicked_results') // Array of story IDs that were clicked
    table.integer('search_time').defaultTo(0) // Search time in milliseconds
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // Indexes for analytics queries
    table.index(['project_id', 'created_at'])
    table.index(['query'])
    table.index(['user_id', 'created_at'])
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('search_analytics')
};