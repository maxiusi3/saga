/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return Promise.all([
    // Prompt usage analytics table
    knex.schema.createTable('prompt_usage_analytics', function(table) {
      table.uuid('id').primary();
      table.uuid('prompt_id').notNullable().references('id').inTable('prompts').onDelete('CASCADE');
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('action').notNullable(); // 'impression', 'engagement', 'completion', 'skip'
      table.text('metadata'); // JSON string for SQLite compatibility
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index(['prompt_id', 'created_at']);
      table.index(['user_id', 'created_at']);
      table.index(['action', 'created_at']);
    }),

    // A/B testing tables
    knex.schema.createTable('ab_tests', function(table) {
      table.string('id').primary();
      table.string('name').notNullable();
      table.text('description');
      table.text('variants').notNullable(); // JSON string for SQLite compatibility
      table.text('traffic_split').notNullable(); // JSON string for SQLite compatibility
      table.string('status').defaultTo('draft'); // 'draft', 'running', 'paused', 'completed'
      table.timestamp('start_date');
      table.timestamp('end_date');
      table.string('target_metric').defaultTo('engagement'); // 'engagement', 'completion', 'skip_rate', 'story_length'
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['status', 'start_date']);
    }),

    knex.schema.createTable('ab_test_assignments', function(table) {
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('test_id').notNullable().references('id').inTable('ab_tests').onDelete('CASCADE');
      table.string('variant_id').notNullable();
      table.timestamp('assigned_at').defaultTo(knex.fn.now());
      
      table.primary(['user_id', 'test_id']);
      table.index(['test_id', 'variant_id']);
    }),

    knex.schema.createTable('ab_test_interactions', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('test_id').notNullable().references('id').inTable('ab_tests').onDelete('CASCADE');
      table.string('variant_id').notNullable();
      table.string('interaction_type').notNullable(); // 'impression', 'engagement', 'completion', 'skip'
      table.text('metadata'); // JSON string for SQLite compatibility
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index(['test_id', 'variant_id', 'created_at']);
      table.index(['user_id', 'created_at']);
    }),

    // User preferences table for prompt customization
    knex.schema.createTable('user_preferences', function(table) {
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('category').notNullable(); // e.g., 'prompt_customization'
      table.text('settings').notNullable(); // JSON string for SQLite compatibility
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.primary(['user_id', 'category']);
    }),

    // Prompt quality scores table
    knex.schema.createTable('prompt_quality_scores', function(table) {
      table.uuid('id').primary();
      table.uuid('prompt_id').notNullable().references('id').inTable('prompts').onDelete('CASCADE');
      table.integer('overall_score').notNullable(); // 0-100
      table.integer('clarity_score').notNullable(); // 0-100
      table.integer('engagement_score').notNullable(); // 0-100
      table.integer('specificity_score').notNullable(); // 0-100
      table.integer('cultural_sensitivity_score').notNullable(); // 0-100
      table.text('feedback'); // JSON string for SQLite compatibility
      table.text('suggestions'); // JSON string for SQLite compatibility
      table.timestamp('analyzed_at').defaultTo(knex.fn.now());
      
      table.index(['prompt_id', 'analyzed_at']);
      table.index(['overall_score']);
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('prompt_quality_scores'),
    knex.schema.dropTableIfExists('user_preferences'),
    knex.schema.dropTableIfExists('ab_test_interactions'),
    knex.schema.dropTableIfExists('ab_test_assignments'),
    knex.schema.dropTableIfExists('ab_tests'),
    knex.schema.dropTableIfExists('prompt_usage_analytics'),
  ]);
};