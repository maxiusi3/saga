/**
 * Create payment events table for tracking payment analytics
 */

exports.up = function(knex) {
  const isPostgreSQL = knex.client.config.client === 'postgresql';
  
  return knex.schema.createTable('payment_events', function(table) {
    if (isPostgreSQL) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    } else {
      table.string('id', 36).primary()
    }
    table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE')
    table.string('event_type').notNullable() // payment_intent_created, payment_succeeded, etc.
    table.string('payment_intent_id').nullable()
    table.integer('amount').nullable() // Amount in cents
    table.string('currency', 3).nullable()
    table.string('package_id').nullable()
    table.string('error_code').nullable()
    table.json('metadata').defaultTo('{}')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // Indexes for analytics queries
    table.index(['event_type', 'created_at'])
    table.index(['user_id', 'event_type'])
    table.index(['package_id', 'created_at'])
    table.index(['payment_intent_id'])
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('payment_events')
}