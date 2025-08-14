/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('story_shares', function(table) {
    table.uuid('id').primary();
    table.uuid('story_id').notNullable().references('id').inTable('stories').onDelete('CASCADE');
    table.uuid('shared_by_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('shared_with_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('message');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes for performance
    table.index(['story_id']);
    table.index(['shared_with_id', 'created_at']);
    table.index(['shared_by_id']);
    
    // Prevent duplicate shares
    table.unique(['story_id', 'shared_by_id', 'shared_with_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('story_shares');
};