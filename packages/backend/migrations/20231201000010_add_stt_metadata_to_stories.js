/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('stories', function(table) {
    table.decimal('transcript_confidence', 3, 2) // 0.00 to 1.00
    table.string('transcript_language', 10) // Language code (e.g., 'en-US')
    table.string('stt_provider', 50) // Which STT provider was used
    table.timestamp('transcript_generated_at')
    table.json('stt_metadata') // Additional STT metadata (word timestamps, etc.)
    table.boolean('has_speaker_diarization').defaultTo(false)
    table.integer('word_count')
    
    // Indexes for querying
    table.index(['transcript_confidence'])
    table.index(['transcript_language'])
    table.index(['stt_provider'])
    table.index(['transcript_generated_at'])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('stories', function(table) {
    table.dropColumn('transcript_confidence')
    table.dropColumn('transcript_language')
    table.dropColumn('stt_provider')
    table.dropColumn('transcript_generated_at')
    table.dropColumn('stt_metadata')
    table.dropColumn('has_speaker_diarization')
    table.dropColumn('word_count')
  })
}