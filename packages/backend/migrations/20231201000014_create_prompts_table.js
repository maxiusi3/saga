/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('prompts', function(table) {
    table.string('id', 36).primary();
    table.text('text').notNullable();
    table.string('audio_url');
    table.string('category', 20).notNullable();
    table.string('difficulty', 20).notNullable();
    table.json('follow_up_questions');
    table.json('tags');
    table.string('personalized_for', 36).references('id').inTable('users').onDelete('CASCADE');
    table.boolean('is_library_prompt').defaultTo(false);
    table.text('template_id');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['category']);
    table.index(['difficulty']);
    table.index(['personalized_for']);
    table.index(['is_library_prompt']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('prompts');
};