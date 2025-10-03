/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('resource_usage_history', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.enum('resource_type', ['project_voucher', 'facilitator_seat', 'storyteller_seat']).notNullable();
    table.integer('amount').notNullable(); // positive for credit, negative for debit
    table.enum('action', ['consume', 'purchase', 'refund']).notNullable();
    table.uuid('project_id').references('id').inTable('projects').onDelete('SET NULL');
    table.text('description');
    table.timestamps(true, true);
    
    table.index(['user_id', 'created_at']);
    table.index(['resource_type', 'action']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('resource_usage_history');
};