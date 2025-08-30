/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('seat_transactions', function(table) {
    table.string('id', 36).primary();
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('transaction_type', 50).notNullable(); // 'purchase', 'consume', 'refund', 'grant', 'expire'
    table.string('resource_type', 50).notNullable(); // 'project_voucher', 'facilitator_seat', 'storyteller_seat'
    table.integer('amount').notNullable(); // positive for credit, negative for debit
    table.string('project_id', 36).nullable().references('id').inTable('projects').onDelete('SET NULL');
    table.text('description').nullable(); // Optional description of the transaction
    table.json('metadata').nullable(); // Additional metadata for the transaction
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    
    // Add indexes for performance
    table.index(['user_id']);
    table.index(['project_id']);
    table.index(['transaction_type']);
    table.index(['resource_type']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('seat_transactions');
};