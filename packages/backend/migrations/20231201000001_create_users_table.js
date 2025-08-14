/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    // Use different UUID generation based on database client
    if (knex.client.config.client === 'sqlite3') {
      table.string('id', 36).primary()
    } else {
      table.string('id', 36).primary()
    }
    table.string('email', 255).unique()
    table.string('phone', 20)
    table.string('name', 255).notNullable()
    table.string('password_hash', 255)
    table.string('oauth_provider', 50)
    table.string('oauth_id', 255)
    table.timestamps(true, true)
    
    // Indexes
    table.index(['email'])
    table.index(['oauth_provider', 'oauth_id'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('users')
}