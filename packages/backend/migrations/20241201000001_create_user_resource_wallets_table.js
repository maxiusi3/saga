/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_resource_wallets', function(table) {
    table.string('user_id', 36).primary().references('id').inTable('users').onDelete('CASCADE');
    table.integer('project_vouchers').defaultTo(0).notNullable();
    table.integer('facilitator_seats').defaultTo(0).notNullable();
    table.integer('storyteller_seats').defaultTo(0).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    
    // Add indexes for performance
    table.index(['user_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('user_resource_wallets');
};