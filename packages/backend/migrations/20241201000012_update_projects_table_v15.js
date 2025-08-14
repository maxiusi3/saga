/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('projects', function(table) {
    // Remove the redundant subscription_expires_at field if it exists
    // The subscription expiry will be managed by the subscriptions table only
    table.dropColumn('subscription_expires_at');
    
    // Ensure status field exists with proper constraints
    table.string('status', 20).defaultTo('active').alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('projects', function(table) {
    // Add back the subscription_expires_at field for rollback
    table.timestamp('subscription_expires_at').notNullable();
    
    // Remove the check constraint (this might need manual cleanup)
    table.dropChecks(['status']);
  });
};