/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_prompts', function(table) {
    table.string('id', 36).primary();
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('prompt_id', 36).notNullable().references('id').inTable('prompts').onDelete('CASCADE');
    table.string('status', 20).notNullable();
    table.text('skip_reason');
    table.string('story_id', 36).references('id').inTable('stories').onDelete('SET NULL');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['user_id']);
    table.index(['prompt_id']);
    table.index(['status']);
    table.index(['created_at']);
    
    // Unique constraint to prevent duplicate prompt presentations
    table.unique(['user_id', 'prompt_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('user_prompts');
};