/**
 * Create purchase receipts table for storing purchase history and receipt data
 */

exports.up = function(knex) {
  const isPostgreSQL = knex.client.config.client === 'postgresql';
  
  return knex.schema.createTable('purchase_receipts', function(table) {
    if (isPostgreSQL) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    } else {
      table.string('id', 36).primary()
    }
    table.string('receipt_id').notNullable().unique()
    table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE')
    table.string('payment_intent_id').notNullable()
    table.string('package_id').notNullable()
    table.string('package_name').notNullable()
    table.text('package_description').nullable()
    table.integer('amount').notNullable() // Amount in cents
    table.string('currency', 3).notNullable().defaultTo('USD')
    table.string('payment_method').nullable()
    table.json('resources').notNullable() // Resources included in package
    table.json('metadata').defaultTo('{}') // Additional metadata
    table.timestamp('purchase_date').notNullable()
    table.boolean('email_sent').defaultTo(false)
    table.timestamp('email_sent_at').nullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // Indexes for common queries
    table.index(['user_id', 'purchase_date'])
    table.index(['package_id', 'purchase_date'])
    table.index(['payment_intent_id'])
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('purchase_receipts')
}