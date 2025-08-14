/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  const isPostgreSQL = knex.client.config.client === 'postgresql';
  
  if (isPostgreSQL) {
    // PostgreSQL full-text search implementation
    return knex.schema.alterTable('stories', function(table) {
      // Add full-text search columns
      table.specificType('search_vector', 'tsvector');
      table.index('search_vector', 'stories_search_vector_idx', 'gin');
    }).then(() => {
      // Create function to update search vector
      return knex.raw(`
        CREATE OR REPLACE FUNCTION update_story_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.search_vector := 
            setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(NEW.transcript, '')), 'B');
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
    }).then(() => {
      // Create trigger to automatically update search vector
      return knex.raw(`
        CREATE TRIGGER update_story_search_vector_trigger
        BEFORE INSERT OR UPDATE ON stories
        FOR EACH ROW
        EXECUTE FUNCTION update_story_search_vector();
      `);
    }).then(() => {
      // Update existing records
      return knex.raw(`
        UPDATE stories 
        SET search_vector = 
          setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(transcript, '')), 'B')
        WHERE search_vector IS NULL;
      `);
    });
  } else {
    // SQLite implementation - just add a simple text column for search indexing
    return knex.schema.alterTable('stories', function(table) {
      table.text('search_content');
      table.index('search_content', 'stories_search_content_idx');
    }).then(() => {
      // Update existing records with concatenated search content
      return knex.raw(`
        UPDATE stories 
        SET search_content = COALESCE(title, '') || ' ' || COALESCE(transcript, '')
        WHERE search_content IS NULL;
      `);
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  const isPostgreSQL = knex.client.config.client === 'postgresql';
  
  if (isPostgreSQL) {
    return knex.raw('DROP TRIGGER IF EXISTS update_story_search_vector_trigger ON stories')
      .then(() => knex.raw('DROP FUNCTION IF EXISTS update_story_search_vector()'))
      .then(() => knex.schema.alterTable('stories', function(table) {
        table.dropIndex('search_vector', 'stories_search_vector_idx');
        table.dropColumn('search_vector');
      }));
  } else {
    return knex.schema.alterTable('stories', function(table) {
      table.dropIndex('search_content', 'stories_search_content_idx');
      table.dropColumn('search_content');
    });
  }
};