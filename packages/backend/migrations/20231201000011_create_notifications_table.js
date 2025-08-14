/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('notifications', function(table) {
    table.string('id', 36).primary()
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('type', 20).notNullable()
    table.string('title', 255).notNullable()
    table.text('body').notNullable()
    table.jsonb('data')
    table.string('status', 20).notNullable().defaultTo('pending')
    table.specificType('delivery_method', 'text[]').notNullable().defaultTo('{}')
    table.timestamp('scheduled_at')
    table.timestamp('sent_at')
    table.timestamp('read_at')
    table.timestamps(true, true)
    
    // Indexes
    table.index(['user_id'])
    table.index(['type'])
    table.index(['status'])
    table.index(['scheduled_at'])
    table.index(['created_at'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('notifications')
}