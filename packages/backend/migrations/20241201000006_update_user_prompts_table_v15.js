/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('user_prompts', function(table) {
    // Add priority field for prompt ordering
    table.integer('priority').defaultTo(1).notNullable();
    
    // Add delivery tracking
    table.boolean('is_delivered').defaultTo(false).notNullable();
    
    // Add indexes for performance
    table.index(['is_delivered']);
    table.index(['priority']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('user_prompts', function(table) {
    table.dropColumn('priority');
    table.dropColumn('is_delivered');
  });
};