/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('stories', function (table) {
        table.timestamp('happened_at').nullable().comment('User-defined date of the memory');
        table.string('recording_mode').defaultTo('deep_dive').comment('Recording mode: deep_dive or chat');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('stories', function (table) {
        table.dropColumn('happened_at');
        table.dropColumn('recording_mode');
    });
};
