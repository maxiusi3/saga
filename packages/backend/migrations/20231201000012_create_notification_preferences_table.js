/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('notification_preferences', function(table) {
    table.string('id', 36).primary()
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.specificType('story_uploaded', 'text[]').notNullable().defaultTo('{"push","email"}')
    table.specificType('story_processed', 'text[]').notNullable().defaultTo('{"push"}')
    table.specificType('interaction_added', 'text[]').notNullable().defaultTo('{"push","email"}')
    table.specificType('follow_up_question', 'text[]').notNullable().defaultTo('{"push","email"}')
    table.specificType('export_ready', 'text[]').notNullable().defaultTo('{"push","email"}')
    table.specificType('invitation_received', 'text[]').notNullable().defaultTo('{"push","email"}')
    table.specificType('subscription_expiring', 'text[]').notNullable().defaultTo('{"push","email"}')
    table.specificType('subscription_expired', 'text[]').notNullable().defaultTo('{"push","email"}')
    table.boolean('email_enabled').notNullable().defaultTo(true)
    table.boolean('push_enabled').notNullable().defaultTo(true)
    table.string('quiet_hours_start', 5) // HH:MM format
    table.string('quiet_hours_end', 5) // HH:MM format
    table.string('timezone', 50).notNullable().defaultTo('UTC')
    table.timestamps(true, true)
    
    // Indexes
    table.unique(['user_id'])
    table.index(['email_enabled'])
    table.index(['push_enabled'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('notification_preferences')
}