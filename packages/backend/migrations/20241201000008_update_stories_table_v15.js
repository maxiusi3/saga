/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('stories', function(table) {
    // Add chapter reference
    table.string('chapter_id', 36).nullable().references('id').inTable('chapters').onDelete('SET NULL');
    
    // Add prompt references
    table.string('prompt_id', 36).nullable().references('id').inTable('prompts').onDelete('SET NULL');
    table.string('user_prompt_id', 36).nullable().references('id').inTable('user_prompts').onDelete('SET NULL');
    
    // Add indexes for performance
    table.index(['chapter_id']);
    table.index(['prompt_id']);
    table.index(['user_prompt_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('stories', function(table) {
    table.dropColumn('chapter_id');
    table.dropColumn('prompt_id');
    table.dropColumn('user_prompt_id');
  });
};