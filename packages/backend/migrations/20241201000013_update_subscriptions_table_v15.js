/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('subscriptions', function(table) {
    // Remove current_period_start as it's not needed for v1.5
    table.dropColumn('current_period_start');
    
    // The indexes already exist, so this is a no-op
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('subscriptions', function(table) {
    table.timestamp('current_period_start').nullable();
  });
};