/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Beta testers table
    .createTable('beta_testers', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('email').notNullable();
      table.string('name').notNullable();
      table.integer('family_size').notNullable();
      table.string('age_range').notNullable();
      table.string('tech_comfort').notNullable(); // 'low', 'medium', 'high'
      table.string('device_type').notNullable(); // 'ios', 'android', 'both'
      table.string('testing_phase').defaultTo('onboarding'); // 'onboarding', 'recording', 'interaction', 'export', 'complete'
      table.timestamp('recruited_at').defaultTo(knex.fn.now());
      table.timestamp('completed_at');
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['testing_phase']);
      table.index(['recruited_at']);
    })
    
    // Testing scenarios table
    .createTable('testing_scenarios', function(table) {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.text('description').notNullable();
      table.string('target_role').notNullable(); // 'facilitator', 'storyteller', 'both'
      table.integer('estimated_duration').notNullable(); // in minutes
      table.text('steps').notNullable(); // JSON string for SQLite compatibility
      table.text('success_criteria').notNullable(); // JSON string for SQLite compatibility
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      table.index(['target_role']);
      table.index(['is_active']);
    })
    
    // Testing sessions table
    .createTable('testing_sessions', function(table) {
      table.uuid('id').primary();
      table.uuid('beta_tester_id').references('id').inTable('beta_testers').onDelete('CASCADE');
      table.uuid('moderator_id').references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('scheduled_at').notNullable();
      table.integer('duration').notNullable(); // in minutes
      table.text('scenarios').notNullable(); // JSON string for SQLite compatibility
      table.string('status').defaultTo('scheduled'); // 'scheduled', 'in_progress', 'completed', 'cancelled'
      table.text('notes');
      table.string('recording_url');
      table.timestamps(true, true);
      
      table.index(['beta_tester_id']);
      table.index(['moderator_id']);
      table.index(['status']);
      table.index(['scheduled_at']);
    })
    
    // User testing feedback table
    .createTable('user_testing_feedback', function(table) {
      table.uuid('id').primary();
      table.uuid('beta_tester_id').references('id').inTable('beta_testers').onDelete('CASCADE');
      table.uuid('scenario_id').references('id').inTable('testing_scenarios').onDelete('CASCADE');
      table.integer('rating').notNullable();
      table.integer('completion_time').notNullable(); // in minutes
      table.boolean('completed_successfully').notNullable();
      table.text('usability_issues').defaultTo('[]'); // JSON string for SQLite compatibility
      table.text('general_feedback');
      table.text('suggestions');
      table.boolean('would_recommend').notNullable();
      table.timestamps(true, true);
      
      table.index(['beta_tester_id']);
      table.index(['scenario_id']);
      table.index(['rating']);
      table.index(['completed_successfully']);
      table.index(['would_recommend']);
    })
    
    // Usability issues table (for detailed tracking)
    .createTable('usability_issues', function(table) {
      table.uuid('id').primary();
      table.uuid('feedback_id').references('id').inTable('user_testing_feedback').onDelete('CASCADE');
      table.string('severity').notNullable(); // 'low', 'medium', 'high', 'critical'
      table.string('category').notNullable(); // 'navigation', 'accessibility', 'performance', 'content', 'functionality'
      table.text('description').notNullable();
      table.string('location').notNullable(); // page/screen where issue occurred
      table.text('reproduction_steps').notNullable(); // JSON string for SQLite compatibility
      table.string('status').defaultTo('open'); // 'open', 'in_progress', 'resolved', 'wont_fix'
      table.uuid('assigned_to').references('id').inTable('users');
      table.timestamp('resolved_at');
      table.timestamps(true, true);
      
      table.index(['feedback_id']);
      table.index(['severity']);
      table.index(['category']);
      table.index(['status']);
      table.index(['assigned_to']);
    })
    
    // Recruitment campaigns table
    .createTable('recruitment_campaigns', function(table) {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.integer('target_count').notNullable();
      table.text('criteria').notNullable(); // JSON string for SQLite compatibility
      table.string('status').defaultTo('active'); // 'active', 'paused', 'completed'
      table.integer('recruited_count').defaultTo(0);
      table.timestamp('started_at').defaultTo(knex.fn.now());
      table.timestamp('ended_at');
      table.timestamps(true, true);
      
      table.index(['status']);
      table.index(['started_at']);
    })
    
    // Testing reports table
    .createTable('testing_reports', function(table) {
      table.uuid('id').primary();
      table.string('report_type').notNullable(); // 'comprehensive', 'usability', 'demographics', etc.
      table.text('data').notNullable(); // JSON string for SQLite compatibility
      table.uuid('generated_by').references('id').inTable('users');
      table.timestamp('period_start');
      table.timestamp('period_end');
      table.timestamps(true, true);
      
      table.index(['report_type']);
      table.index(['generated_by']);
      table.index(['created_at']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('testing_reports')
    .dropTableIfExists('recruitment_campaigns')
    .dropTableIfExists('usability_issues')
    .dropTableIfExists('user_testing_feedback')
    .dropTableIfExists('testing_sessions')
    .dropTableIfExists('testing_scenarios')
    .dropTableIfExists('beta_testers');
};