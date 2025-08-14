/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('chapters', function(table) {
    table.string('id', 36).primary();
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    table.integer('order_index').notNullable();
    table.boolean('is_active').defaultTo(true).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    
    // Add indexes for performance
    table.index(['order_index']);
    table.index(['is_active']);
    
    // Ensure unique order_index for active chapters
    table.unique(['order_index']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('chapters');
};