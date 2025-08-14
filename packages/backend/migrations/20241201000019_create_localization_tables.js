/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return Promise.all([
    // Localized prompts table
    knex.schema.createTable('localized_prompts', function(table) {
      table.uuid('id').primary();
      table.uuid('original_prompt_id').notNullable().references('id').inTable('prompts').onDelete('CASCADE');
      table.string('language', 10).notNullable(); // ISO language code (e.g., 'es', 'fr', 'de')
      table.text('text').notNullable();
      table.text('follow_up_questions'); // JSON string for SQLite compatibility
      table.text('cultural_adaptations'); // JSON string for SQLite compatibility
      table.string('translated_by'); // Translator identifier
      table.string('reviewed_by'); // Reviewer identifier
      table.string('status').defaultTo('draft'); // 'draft', 'review', 'approved', 'deprecated'
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.unique(['original_prompt_id', 'language']);
      table.index(['language', 'status']);
      table.index(['original_prompt_id']);
    }),

    // Prompt versions table for backup and versioning
    knex.schema.createTable('prompt_versions', function(table) {
      table.uuid('id').primary();
      table.uuid('prompt_id').notNullable().references('id').inTable('prompts').onDelete('CASCADE');
      table.integer('version').notNullable();
      table.text('text').notNullable();
      table.string('category').notNullable();
      table.string('difficulty').notNullable();
      table.text('tags'); // JSON string for SQLite compatibility
      table.text('follow_up_questions'); // JSON string for SQLite compatibility
      table.string('audio_url');
      table.text('change_reason');
      table.string('changed_by');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.unique(['prompt_id', 'version']);
      table.index(['prompt_id', 'created_at']);
    }),

    // Prompt backups table
    knex.schema.createTable('prompt_backups', function(table) {
      table.uuid('id').primary();
      table.string('backup_type').notNullable(); // 'manual', 'scheduled', 'pre_update'
      table.integer('prompt_count').notNullable();
      table.string('file_path').notNullable();
      table.bigInteger('file_size').notNullable();
      table.string('checksum').notNullable();
      table.string('created_by');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index(['backup_type', 'created_at']);
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('prompt_backups'),
    knex.schema.dropTableIfExists('prompt_versions'),
    knex.schema.dropTableIfExists('localized_prompts'),
  ]);
};