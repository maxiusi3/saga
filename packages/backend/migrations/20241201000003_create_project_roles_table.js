/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('project_roles', function(table) {
    table.string('id', 36).primary();
    table.string('project_id', 36).notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('role', 20).notNullable(); // 'facilitator', 'storyteller'
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    
    // Ensure unique combination of project, user, and role
    table.unique(['project_id', 'user_id', 'role']);
    
    // Add indexes for performance
    table.index(['project_id']);
    table.index(['user_id']);
    table.index(['role']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('project_roles');
};