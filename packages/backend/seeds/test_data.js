/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('user_resource_wallets').del();
  await knex('user_settings').del();

  // Insert test data
  await knex('user_settings').insert([
    {
      user_id: 'test-user-1',
      notification_email: true,
      notification_push: true,
      notification_story_updates: true,
      notification_follow_up_questions: true,
      notification_weekly_digest: true,
      notification_marketing_emails: false,
      accessibility_font_size: 'standard',
      accessibility_high_contrast: false,
      accessibility_reduced_motion: false,
      accessibility_screen_reader: false,
      privacy_profile_visible: true,
      privacy_story_sharing: true,
      privacy_data_analytics: false,
      privacy_two_factor_auth: false,
      audio_volume: 75,
      audio_quality: 'high',
      language: 'en',
      timezone: 'UTC'
    }
  ]);

  await knex('user_resource_wallets').insert([
    {
      user_id: 'test-user-1',
      project_vouchers: 2,
      facilitator_seats: 1,
      storyteller_seats: 3
    }
  ]);
};
