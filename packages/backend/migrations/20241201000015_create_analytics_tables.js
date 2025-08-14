/**
 * Create analytics tables for tracking project and user events
 */

exports.up = function(knex) {
  const isPostgreSQL = knex.client.config.client === 'postgresql';

  return Promise.all([
    // General analytics events table
    knex.schema.createTable('analytics_events', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('event_type').notNullable().index()
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE').index()
      table.string('project_id', 36).references('id').inTable('projects').onDelete('CASCADE').index()
      table.text('properties').defaultTo('{}')
      table.timestamp('created_at').defaultTo(knex.fn.now()).index()
      
      // Indexes for common queries
      table.index(['event_type', 'created_at'])
      table.index(['user_id', 'created_at'])
      table.index(['project_id', 'created_at'])
    }),

    // Project-specific analytics events
    knex.schema.createTable('project_analytics_events', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('event_type').notNullable().index()
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE').index()
      table.string('project_id', 36).references('id').inTable('projects').onDelete('CASCADE').index()
      table.text('event_data').notNullable()
      table.timestamp('created_at').defaultTo(knex.fn.now()).index()
      
      // Indexes for analytics queries
      table.index(['event_type', 'created_at'])
      table.index(['user_id', 'event_type'])
      table.index(['project_id', 'event_type'])
    }),

    // User session tracking
    knex.schema.createTable('user_sessions', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE')
      table.string('session_id').notNullable()
      table.string('device_type').nullable() // 'web', 'mobile', 'tablet'
      table.string('browser').nullable()
      table.string('os').nullable()
      table.string('ip_address').nullable()
      table.string('user_agent').nullable()
      table.string('referrer').nullable()
      table.timestamp('started_at').defaultTo(knex.fn.now())
      table.timestamp('last_activity_at').defaultTo(knex.fn.now())
      table.timestamp('ended_at').nullable()
      table.integer('duration_seconds').nullable()
      table.integer('page_views').defaultTo(0)
      table.text('pages_visited').defaultTo('[]')
      
      // Indexes for session analysis
      table.index(['user_id', 'started_at'])
      table.index(['session_id'])
      table.index(['started_at'])
    }),

    // Feature usage tracking
    knex.schema.createTable('feature_usage', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE').index()
      table.string('project_id', 36).references('id').inTable('projects').onDelete('CASCADE').nullable().index()
      table.string('feature_name').notNullable().index()
      table.string('action').notNullable() // 'used', 'clicked', 'viewed', etc.
      table.text('context').defaultTo('{}') // Additional context about usage
      table.timestamp('used_at').defaultTo(knex.fn.now()).index()
      
      // Indexes for feature analysis
      table.index(['feature_name', 'used_at'])
      table.index(['user_id', 'feature_name'])
      table.index(['project_id', 'feature_name'])
    }),

    // Error tracking
    knex.schema.createTable('error_logs', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE').nullable().index()
      table.string('project_id', 36).references('id').inTable('projects').onDelete('CASCADE').nullable().index()
      table.string('error_type').notNullable().index()
      table.string('error_message').notNullable()
      table.text('stack_trace').nullable()
      table.string('url').nullable()
      table.string('user_agent').nullable()
      table.text('context').defaultTo('{}')
      table.timestamp('occurred_at').defaultTo(knex.fn.now()).index()
      
      // Indexes for error analysis
      table.index(['error_type', 'occurred_at'])
      table.index(['user_id', 'occurred_at'])
    })
  ])
}

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('error_logs'),
    knex.schema.dropTableIfExists('feature_usage'),
    knex.schema.dropTableIfExists('user_sessions'),
    knex.schema.dropTableIfExists('project_analytics_events'),
    knex.schema.dropTableIfExists('analytics_events')
  ])
}