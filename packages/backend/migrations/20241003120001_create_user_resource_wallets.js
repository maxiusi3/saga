/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_resource_wallets', function(table) {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    table.integer('project_vouchers').defaultTo(0);
    table.integer('facilitator_seats').defaultTo(0);
    table.integer('storyteller_seats').defaultTo(0);
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('user_resource_wallets');
};