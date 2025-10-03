/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_settings', function(table) {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    
    // Notification settings
    table.boolean('notification_email').defaultTo(true);
    table.boolean('notification_push').defaultTo(true);
    table.boolean('notification_story_updates').defaultTo(true);
    table.boolean('notification_follow_up_questions').defaultTo(true);
    table.boolean('notification_weekly_digest').defaultTo(true);
    table.boolean('notification_marketing_emails').defaultTo(false);
    
    // Accessibility settings
    table.enum('accessibility_font_size', ['standard', 'large', 'extra-large']).defaultTo('standard');
    table.boolean('accessibility_high_contrast').defaultTo(false);
    table.boolean('accessibility_reduced_motion').defaultTo(false);
    table.boolean('accessibility_screen_reader').defaultTo(false);
    
    // Privacy settings
    table.boolean('privacy_profile_visible').defaultTo(true);
    table.boolean('privacy_story_sharing').defaultTo(true);
    table.boolean('privacy_data_analytics').defaultTo(false);
    table.boolean('privacy_two_factor_auth').defaultTo(false);
    
    // Audio settings
    table.integer('audio_volume').defaultTo(75);
    table.enum('audio_quality', ['low', 'medium', 'high']).defaultTo('high');
    
    // Language and region
    table.string('language', 10).defaultTo('en');
    table.string('timezone', 50).defaultTo('UTC');
    
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('user_settings');
};