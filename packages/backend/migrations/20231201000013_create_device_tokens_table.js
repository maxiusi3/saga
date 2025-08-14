/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('device_tokens', function(table) {
    table.string('id', 36).primary()
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('token', 500).notNullable()
    table.string('platform', 20).notNullable()
    table.string('device_id', 255)
    table.boolean('is_active').notNullable().defaultTo(true)
    table.timestamp('last_used_at').notNullable().defaultTo(knex.fn.now())
    table.timestamps(true, true)
    
    // Indexes
    table.index(['user_id'])
    table.index(['token'])
    table.index(['platform'])
    table.index(['is_active'])
    table.index(['last_used_at'])
    
    // Unique constraint on user_id + token to prevent duplicates
    table.unique(['user_id', 'token'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('device_tokens')
}