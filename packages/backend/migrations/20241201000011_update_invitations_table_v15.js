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
    
    // Add invited_by field to track who sent the invitation
    table.string('invited_by', 36).references('id').inTable('users').onDelete('CASCADE');
    
    // Add email field for invitation target
    table.string('email', 255);
    
    // Add seat_reserved field to track seat reservation status
    table.boolean('seat_reserved').defaultTo(false);
    
    // Add index for status queries
    table.index(['status']);
    table.index(['role']);
    table.index(['invited_by']);
    table.index(['seat_reserved']);
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
    table.dropColumn('invited_by');
    table.dropColumn('email');
    table.dropColumn('seat_reserved');
  });
};