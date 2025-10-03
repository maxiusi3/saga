/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('user_settings', function(table) {
      table.string('user_id').primary();
      table.boolean('notification_email').defaultTo(true);
      table.boolean('notification_push').defaultTo(true);
      table.boolean('notification_story_updates').defaultTo(true);
      table.boolean('notification_follow_up_questions').defaultTo(true);
      table.boolean('notification_weekly_digest').defaultTo(true);
      table.boolean('notification_marketing_emails').defaultTo(false);
      table.string('accessibility_font_size').defaultTo('standard');
      table.boolean('accessibility_high_contrast').defaultTo(false);
      table.boolean('accessibility_reduced_motion').defaultTo(false);
      table.boolean('accessibility_screen_reader').defaultTo(false);
      table.boolean('privacy_profile_visible').defaultTo(true);
      table.boolean('privacy_story_sharing').defaultTo(true);
      table.boolean('privacy_data_analytics').defaultTo(false);
      table.boolean('privacy_two_factor_auth').defaultTo(false);
      table.integer('audio_volume').defaultTo(75);
      table.string('audio_quality').defaultTo('high');
      table.string('language', 10).defaultTo('en');
      table.string('timezone', 50).defaultTo('UTC');
      table.timestamps(true, true);
    })
    .createTable('user_resource_wallets', function(table) {
      table.string('user_id').primary();
      table.integer('project_vouchers').defaultTo(0);
      table.integer('facilitator_seats').defaultTo(0);
      table.integer('storyteller_seats').defaultTo(0);
      table.timestamps(true, true);
    })
    .createTable('resource_usage_history', function(table) {
      table.string('id').primary();
      table.string('user_id');
      table.string('resource_type', 50);
      table.integer('amount');
      table.string('action', 20);
      table.string('project_id');
      table.timestamps(true, true);
      table.index(['user_id']);
    })
    .createTable('projects', function(table) {
      table.string('id').primary();
      table.string('name', 255).notNullable();
      table.text('description');
      table.string('facilitator_id');
      table.string('status').defaultTo('active');
      table.text('settings');
      table.timestamps(true, true);
      table.index(['facilitator_id']);
    })
    .createTable('project_members', function(table) {
      table.string('id').primary();
      table.string('project_id');
      table.string('user_id');
      table.string('role').notNullable();
      table.string('status').defaultTo('pending');
      table.timestamp('invited_at').defaultTo(knex.fn.now());
      table.string('invited_by');
      table.timestamps(true, true);
      table.index(['user_id']);
      table.index(['project_id']);
    })
    .createTable('stories', function(table) {
      table.string('id').primary();
      table.string('project_id');
      table.string('storyteller_id');
      table.string('title', 500).notNullable();
      table.text('content');
      table.text('transcript');
      table.string('audio_url');
      table.integer('audio_duration');
      table.text('photos');
      table.string('status').defaultTo('draft');
      table.text('ai_prompts');
      table.text('metadata');
      table.timestamps(true, true);
      table.index(['project_id']);
    })
    .createTable('story_comments', function(table) {
      table.string('id').primary();
      table.string('story_id');
      table.string('user_id');
      table.text('content').notNullable();
      table.string('parent_id');
      table.timestamps(true, true);
      table.index(['story_id']);
    })
    .createTable('story_follow_up_questions', function(table) {
      table.string('id').primary();
      table.string('story_id');
      table.string('asked_by');
      table.text('question').notNullable();
      table.text('answer');
      table.string('status').defaultTo('pending');
      table.timestamps(true, true);
      table.index(['story_id']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('story_follow_up_questions')
    .dropTableIfExists('story_comments')
    .dropTableIfExists('stories')
    .dropTableIfExists('project_members')
    .dropTableIfExists('projects')
    .dropTableIfExists('resource_usage_history')
    .dropTableIfExists('user_resource_wallets')
    .dropTableIfExists('user_settings');
};
