/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('invitations', function(table) {
    // Add explicit status tracking if not exists
    table.string('status', 20).defaultTo('pending');
    
    // Add role field if not exists
    table.string('role', 20).notNullable();
    
    // Add index for status queries
    table.index(['status']);
    table.index(['role']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('invitations', function(table) {
    table.dropColumn('status');
    table.dropColumn('role');
  });
};