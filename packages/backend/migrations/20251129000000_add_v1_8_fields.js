/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('stories', function (table) {
        table.boolean('is_public').defaultTo(false);
        table.string('mastered_audio_url');
        // We can store resonance data in the existing 'metadata' JSON field
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('stories', function (table) {
        table.dropColumn('is_public');
        table.dropColumn('mastered_audio_url');
    });
};
