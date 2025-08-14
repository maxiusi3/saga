/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('chapter_summaries', function(table) {
    // Add chapter reference for v1.5
    table.string('chapter_id', 36).nullable().references('id').inTable('chapters').onDelete('SET NULL');
    
    // Add story count for analytics
    table.integer('story_count').defaultTo(0).notNullable();
    
    // Add index for chapter_id
    table.index(['chapter_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('chapter_summaries', function(table) {
    table.dropColumn('chapter_id');
    table.dropColumn('story_count');
  });
};