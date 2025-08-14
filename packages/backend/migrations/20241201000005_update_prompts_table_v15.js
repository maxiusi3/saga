/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('prompts', function(table) {
    // Add chapter reference
    table.string('chapter_id', 36).nullable().references('id').inTable('chapters').onDelete('SET NULL');
    
    // Add order_index for chapter-based ordering
    table.integer('order_index').defaultTo(0);
    
    // Add is_active flag
    table.boolean('is_active').defaultTo(true);
    
    // Add indexes for performance
    table.index(['chapter_id']);
    table.index(['order_index']);
    table.index(['is_active']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('prompts', function(table) {
    table.dropColumn('chapter_id');
    table.dropColumn('order_index');
    table.dropColumn('is_active');
  });
};