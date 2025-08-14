/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('stories', function(table) {
    table.string('id', 36).primary()
    table.string('project_id', 36).notNullable().references('id').inTable('projects').onDelete('CASCADE')
    table.string('title', 255)
    table.string('audio_url', 500).notNullable()
    table.integer('audio_duration') // in seconds
    table.text('transcript')
    table.text('original_transcript')
    table.string('photo_url', 500)
    table.text('ai_prompt')
    table.string('status', 20).defaultTo('processing')
    table.timestamps(true, true)
    
    // Indexes
    table.index(['project_id'])
    table.index(['status'])
    table.index(['created_at'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('stories')
}