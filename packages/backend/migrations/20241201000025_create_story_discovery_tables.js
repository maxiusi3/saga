/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  const isPostgreSQL = knex.client.config.client === 'postgresql';

  return knex.schema
    // Story categories table
    .createTable('story_categories', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('name', 100).notNullable().unique()
      table.text('description')
      table.string('color', 7).defaultTo('#6B7280') // Hex color code
      table.string('icon', 50)
      table.integer('usage_count').defaultTo(0)
      table.timestamps(true, true)
      
      table.index(['name'])
    })
    
    // Story tags table
    .createTable('story_tags', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('name', 50).notNullable().unique()
      table.integer('usage_count').defaultTo(0)
      table.timestamps(true, true)
      
      table.index(['name'])
      table.index(['usage_count'])
    })
    
    // Story-category relationships
    .createTable('story_category_assignments', function(table) {
      table.string('story_id', 36).references('id').inTable('stories').onDelete('CASCADE')
      table.string('category_id', 36).references('id').inTable('story_categories').onDelete('CASCADE')
      table.timestamps(true, true)
      
      table.primary(['story_id', 'category_id'])
      table.index(['story_id'])
      table.index(['category_id'])
    })
    
    // Story-tag relationships
    .createTable('story_tag_assignments', function(table) {
      table.string('story_id', 36).references('id').inTable('stories').onDelete('CASCADE')
      table.string('tag_id', 36).references('id').inTable('story_tags').onDelete('CASCADE')
      table.timestamps(true, true)
      
      table.primary(['story_id', 'tag_id'])
      table.index(['story_id'])
      table.index(['tag_id'])
    })
    
    // User bookmarks
    .createTable('story_bookmarks', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE')
      table.string('story_id', 36).references('id').inTable('stories').onDelete('CASCADE')
      table.string('collection_id', 36).references('id').inTable('bookmark_collections').onDelete('SET NULL')
      table.text('notes')
      table.timestamps(true, true)
      
      table.unique(['user_id', 'story_id'])
      table.index(['user_id'])
      table.index(['story_id'])
      table.index(['collection_id'])
    })
    
    // Bookmark collections
    .createTable('bookmark_collections', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE')
      table.string('name', 100).notNullable()
      table.text('description')
      table.boolean('is_public').defaultTo(false)
      table.string('color', 7).defaultTo('#6B7280')
      table.timestamps(true, true)
      
      table.index(['user_id'])
      table.index(['is_public'])
    })
    
    // Story listening progress
    .createTable('story_progress', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE')
      table.string('story_id', 36).references('id').inTable('stories').onDelete('CASCADE')
      table.integer('progress_seconds').defaultTo(0)
      table.integer('total_seconds')
      table.decimal('completion_percentage', 5, 2).defaultTo(0)
      table.integer('last_position_seconds').defaultTo(0)
      table.timestamp('completed_at')
      table.timestamps(true, true)
      
      table.unique(['user_id', 'story_id'])
      table.index(['user_id'])
      table.index(['story_id'])
      table.index(['completion_percentage'])
    })
    
    // Listening sessions
    .createTable('listening_sessions', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE')
      table.string('story_id', 36).references('id').inTable('stories').onDelete('CASCADE')
      table.timestamp('start_time').defaultTo(knex.fn.now())
      table.timestamp('end_time')
      table.integer('duration_seconds')
      table.string('device_type', 50)
      table.json('metadata') // Additional session data
      table.timestamps(true, true)
      
      table.index(['user_id'])
      table.index(['story_id'])
      table.index(['start_time'])
    })
    
    // Story collections/playlists
    .createTable('story_collections', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('creator_id', 36).references('id').inTable('users').onDelete('CASCADE')
      table.string('name', 100).notNullable()
      table.text('description')
      table.boolean('is_playlist').defaultTo(false)
      table.boolean('is_public').defaultTo(false)
      table.boolean('auto_play').defaultTo(false)
      table.string('color', 7).defaultTo('#6B7280')
      table.string('cover_image_url')
      table.timestamps(true, true)
      
      table.index(['creator_id'])
      table.index(['is_public'])
      table.index(['is_playlist'])
    })
    
    // Collection items
    .createTable('collection_items', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('collection_id', 36).references('id').inTable('story_collections').onDelete('CASCADE')
      table.string('story_id', 36).references('id').inTable('stories').onDelete('CASCADE')
      table.integer('order_index').notNullable()
      table.timestamps(true, true)
      
      table.unique(['collection_id', 'story_id'])
      table.index(['collection_id', 'order_index'])
      table.index(['story_id'])
    })
    
    // Timeline analytics
    .createTable('timeline_analytics', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE')
      table.string('action', 50).notNullable() // 'view', 'filter', 'click_story'
      table.json('metadata') // Filter data, story info, etc.
      table.timestamps(true, true)
      
      table.index(['user_id'])
      table.index(['action'])
      table.index(['created_at'])
    })
    
    // Story recommendations
    .createTable('story_recommendations', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE')
      table.string('story_id', 36).references('id').inTable('stories').onDelete('CASCADE')
      table.string('algorithm', 50).notNullable() // 'content_based', 'collaborative', 'hybrid'
      table.decimal('score', 5, 4).notNullable() // Recommendation score 0-1
      table.json('reasoning') // Why this was recommended
      table.boolean('clicked').defaultTo(false)
      table.boolean('dismissed').defaultTo(false)
      table.timestamp('expires_at')
      table.timestamps(true, true)
      
      table.unique(['user_id', 'story_id'])
      table.index(['user_id'])
      table.index(['story_id'])
      table.index(['score'])
      table.index(['expires_at'])
    })
    
    // Recommendation analytics
    .createTable('recommendation_analytics', function(table) {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      } else {
        table.string('id', 36).primary()
      }
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE')
      table.string('story_id', 36).references('id').inTable('stories').onDelete('CASCADE')
      table.string('action', 50).notNullable() // 'click', 'dismiss', 'like', 'dislike'
      table.timestamps(true, true)
      
      table.index(['user_id'])
      table.index(['story_id'])
      table.index(['action'])
      table.index(['created_at'])
    })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('recommendation_analytics')
    .dropTableIfExists('story_recommendations')
    .dropTableIfExists('timeline_analytics')
    .dropTableIfExists('collection_items')
    .dropTableIfExists('story_collections')
    .dropTableIfExists('listening_sessions')
    .dropTableIfExists('story_progress')
    .dropTableIfExists('bookmark_collections')
    .dropTableIfExists('story_bookmarks')
    .dropTableIfExists('story_tag_assignments')
    .dropTableIfExists('story_category_assignments')
    .dropTableIfExists('story_tags')
    .dropTableIfExists('story_categories')
}