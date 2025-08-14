/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('story_favorites', function(table) {
    table.uuid('id').primary()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('story_id').notNullable().references('id').inTable('stories').onDelete('CASCADE')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    
    // Ensure a user can only favorite a story once
    table.unique(['user_id', 'story_id'])
    
    // Indexes for performance
    table.index(['user_id'])
    table.index(['story_id'])
    table.index(['created_at'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('story_favorites')
}