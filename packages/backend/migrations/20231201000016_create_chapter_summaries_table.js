/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('chapter_summaries', function(table) {
    table.string('id', 36).primary()
    table.string('project_id', 36).notNullable()
    table.string('title', 255).notNullable()
    table.text('description').notNullable()
    table.string('theme', 100).notNullable()
    table.json('story_ids').notNullable() // Array of story IDs
    table.json('key_highlights').notNullable() // Array of key highlights
    table.json('timeframe').nullable() // { start?: string, end?: string }
    table.string('emotional_tone', 20).defaultTo('neutral')
    table.string('status', 20).defaultTo('generating')
    table.timestamps(true, true)

    // Foreign key constraints
    table.foreign('project_id').references('id').inTable('projects').onDelete('CASCADE')
    
    // Indexes
    table.index('project_id')
    table.index('theme')
    table.index('status')
    table.index('created_at')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('chapter_summaries')
}