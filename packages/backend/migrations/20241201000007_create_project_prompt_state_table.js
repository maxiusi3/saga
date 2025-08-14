/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('project_prompt_state', function(table) {
    table.string('project_id', 36).primary().references('id').inTable('projects').onDelete('CASCADE');
    table.string('current_chapter_id', 36).nullable().references('id').inTable('chapters').onDelete('SET NULL');
    table.integer('current_prompt_index').defaultTo(0).notNullable();
    table.timestamp('last_prompt_delivered_at').nullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    
    // Add indexes for performance
    table.index(['current_chapter_id']);
    table.index(['last_prompt_delivered_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('project_prompt_state');
};