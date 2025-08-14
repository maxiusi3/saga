import { BaseService } from './base-service'
import { Story } from '@saga/shared'

export interface SearchResult {
  story: Story
  rank: number
  headline?: string
}

export interface SearchOptions {
  page?: number
  limit?: number
  chapterIds?: string[]
  facilitatorIds?: string[]
  dateFrom?: Date
  dateTo?: Date
  sortBy?: 'relevance' | 'date'
}

export interface SearchAnalytics {
  query: string
  projectId: string
  userId: string
  resultCount: number
  clickedResults?: string[]
  searchTime: number
}

export class SearchService extends BaseService {
  /**
   * Performs full-text search across story transcripts and titles
   * Uses PostgreSQL FTS when available, falls back to LIKE queries for SQLite
   */
  async searchStories(
    projectId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<{
    results: SearchResult[]
    total: number
    page: number
    limit: number
    hasMore: boolean
    searchTime: number
  }> {
    const startTime = Date.now()
    const {
      page = 1,
      limit = 20,
      chapterIds,
      facilitatorIds,
      dateFrom,
      dateTo,
      sortBy = 'relevance'
    } = options

    const offset = (page - 1) * limit

    // Sanitize and prepare the search query
    const sanitizedQuery = this.sanitizeSearchQuery(query)
    if (!sanitizedQuery) {
      return {
        results: [],
        total: 0,
        page,
        limit,
        hasMore: false,
        searchTime: Date.now() - startTime
      }
    }

    const isPostgreSQL = this.db.client.config.client === 'postgresql'

    let searchQuery: any
    let countQuery: any

    if (isPostgreSQL) {
      // PostgreSQL full-text search
      searchQuery = this.db('stories')
        .select(
          'stories.*',
          this.db.raw('ts_rank(search_vector, plainto_tsquery(\'english\', ?)) as rank', [sanitizedQuery]),
          this.db.raw('ts_headline(\'english\', COALESCE(transcript, title), plainto_tsquery(\'english\', ?), \'MaxWords=20, MinWords=5\') as headline', [sanitizedQuery])
        )
        .leftJoin('users as storytellers', 'stories.storyteller_id', 'storytellers.id')
        .leftJoin('chapters', 'stories.chapter_id', 'chapters.id')
        .where('stories.project_id', projectId)
        .where('stories.status', 'ready')
        .whereRaw('search_vector @@ plainto_tsquery(\'english\', ?)', [sanitizedQuery])

      countQuery = this.db('stories')
        .where('project_id', projectId)
        .where('status', 'ready')
        .whereRaw('search_vector @@ plainto_tsquery(\'english\', ?)', [sanitizedQuery])
    } else {
      // SQLite LIKE-based search
      const likeQuery = `%${sanitizedQuery}%`
      
      searchQuery = this.db('stories')
        .select(
          'stories.*',
          this.db.raw('1.0 as rank'), // Simple ranking for SQLite
          this.db.raw('SUBSTR(COALESCE(transcript, title), 1, 200) as headline') // Simple headline
        )
        .leftJoin('users as storytellers', 'stories.storyteller_id', 'storytellers.id')
        .leftJoin('chapters', 'stories.chapter_id', 'chapters.id')
        .where('stories.project_id', projectId)
        .where('stories.status', 'ready')
        .where(function() {
          this.where('stories.title', 'like', likeQuery)
            .orWhere('stories.transcript', 'like', likeQuery)
            .orWhere('stories.search_content', 'like', likeQuery)
        })

      countQuery = this.db('stories')
        .where('project_id', projectId)
        .where('status', 'ready')
        .where(function() {
          this.where('title', 'like', likeQuery)
            .orWhere('transcript', 'like', likeQuery)
            .orWhere('search_content', 'like', likeQuery)
        })
    }

    // Apply filters to both queries
    const applyFilters = (query: any) => {
      if (chapterIds && chapterIds.length > 0) {
        query = query.whereIn('stories.chapter_id', chapterIds)
      }

      if (facilitatorIds && facilitatorIds.length > 0) {
        query = query.whereIn('stories.storyteller_id', facilitatorIds)
      }

      if (dateFrom) {
        query = query.where('stories.created_at', '>=', dateFrom)
      }

      if (dateTo) {
        query = query.where('stories.created_at', '<=', dateTo)
      }

      return query
    }

    searchQuery = applyFilters(searchQuery)
    countQuery = applyFilters(countQuery)

    // Apply sorting
    if (sortBy === 'relevance' && isPostgreSQL) {
      searchQuery = searchQuery.orderBy('rank', 'desc')
    } else {
      searchQuery = searchQuery.orderBy('stories.created_at', 'desc')
    }

    const [results, totalResult] = await Promise.all([
      searchQuery.limit(limit).offset(offset),
      countQuery.count('* as count').first()
    ])

    const total = parseInt(totalResult?.count as string) || 0
    const searchTime = Date.now() - startTime

    const searchResults: SearchResult[] = results.map(row => ({
      story: {
        id: row.id,
        projectId: row.project_id,
        storytellerId: row.storyteller_id,
        title: row.title,
        audioUrl: row.audio_url,
        audioDuration: row.audio_duration,
        transcript: row.transcript,
        originalTranscript: row.original_transcript,
        photoUrl: row.photo_url,
        promptId: row.prompt_id,
        userPromptId: row.user_prompt_id,
        chapterId: row.chapter_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      rank: parseFloat(row.rank) || 0,
      headline: row.headline
    }))

    return {
      results: searchResults,
      total,
      page,
      limit,
      hasMore: offset + results.length < total,
      searchTime
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(
    projectId: string,
    partialQuery: string,
    limit = 5
  ): Promise<string[]> {
    const sanitizedQuery = this.sanitizeSearchQuery(partialQuery)
    if (!sanitizedQuery || sanitizedQuery.length < 2) {
      return []
    }

    // Get common words from transcripts that match the partial query
    const suggestions = await this.db('stories')
      .select(this.db.raw('unnest(string_to_array(lower(transcript), \' \')) as word'))
      .where('project_id', projectId)
      .where('status', 'ready')
      .whereRaw('lower(transcript) LIKE ?', [`%${sanitizedQuery.toLowerCase()}%`])
      .groupBy('word')
      .havingRaw('length(word) > 2')
      .havingRaw('word LIKE ?', [`${sanitizedQuery.toLowerCase()}%`])
      .orderByRaw('count(*) DESC')
      .limit(limit)

    return suggestions.map(row => row.word).filter(word => 
      word && 
      word.length > 2 && 
      /^[a-zA-Z]+$/.test(word) // Only alphabetic words
    )
  }

  /**
   * Track search analytics
   */
  async trackSearchAnalytics(analytics: SearchAnalytics): Promise<void> {
    try {
      await this.db('search_analytics').insert({
        query: analytics.query,
        project_id: analytics.projectId,
        user_id: analytics.userId,
        result_count: analytics.resultCount,
        clicked_results: analytics.clickedResults ? JSON.stringify(analytics.clickedResults) : null,
        search_time: analytics.searchTime,
        created_at: new Date()
      })
    } catch (error) {
      // Log error but don't fail the search
      console.error('Failed to track search analytics:', error)
    }
  }

  /**
   * Get search analytics for a project
   */
  async getSearchAnalytics(
    projectId: string,
    options: {
      dateFrom?: Date
      dateTo?: Date
      limit?: number
    } = {}
  ): Promise<{
    topQueries: Array<{ query: string; count: number }>
    totalSearches: number
    averageResultCount: number
    averageSearchTime: number
  }> {
    const { dateFrom, dateTo, limit = 10 } = options

    let query = this.db('search_analytics')
      .where('project_id', projectId)

    if (dateFrom) {
      query = query.where('created_at', '>=', dateFrom)
    }
    if (dateTo) {
      query = query.where('created_at', '<=', dateTo)
    }

    const [topQueries, stats] = await Promise.all([
      query.clone()
        .select('query')
        .count('* as count')
        .groupBy('query')
        .orderBy('count', 'desc')
        .limit(limit),
      query.clone()
        .select(
          this.db.raw('COUNT(*) as total_searches'),
          this.db.raw('AVG(result_count) as avg_result_count'),
          this.db.raw('AVG(search_time) as avg_search_time')
        )
        .first()
    ])

    return {
      topQueries: topQueries.map(row => ({
        query: row.query,
        count: parseInt(row.count as string)
      })),
      totalSearches: parseInt(stats?.total_searches as string) || 0,
      averageResultCount: parseFloat(stats?.avg_result_count as string) || 0,
      averageSearchTime: parseFloat(stats?.avg_search_time as string) || 0
    }
  }

  /**
   * Manually reindex a story's search vector/content
   */
  async reindexStory(storyId: string): Promise<void> {
    const isPostgreSQL = this.db.client.config.client === 'postgresql'
    
    if (isPostgreSQL) {
      await this.db.raw(`
        UPDATE stories 
        SET search_vector = 
          setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(transcript, '')), 'B')
        WHERE id = ?
      `, [storyId])
    } else {
      await this.db.raw(`
        UPDATE stories 
        SET search_content = COALESCE(title, '') || ' ' || COALESCE(transcript, '')
        WHERE id = ?
      `, [storyId])
    }
  }

  /**
   * Reindex all stories for a project
   */
  async reindexProject(projectId: string): Promise<number> {
    const isPostgreSQL = this.db.client.config.client === 'postgresql'
    
    if (isPostgreSQL) {
      const result = await this.db.raw(`
        UPDATE stories 
        SET search_vector = 
          setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(transcript, '')), 'B')
        WHERE project_id = ? AND status = 'ready'
      `, [projectId])

      return result.rowCount || 0
    } else {
      const result = await this.db.raw(`
        UPDATE stories 
        SET search_content = COALESCE(title, '') || ' ' || COALESCE(transcript, '')
        WHERE project_id = ? AND status = 'ready'
      `, [projectId])

      return result.changes || 0
    }
  }

  /**
   * Sanitize search query to prevent injection and improve search quality
   */
  private sanitizeSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return ''
    }

    // Remove special characters that could interfere with PostgreSQL FTS
    const sanitized = query
      .trim()
      .replace(/[^\w\s-]/g, ' ') // Keep only word characters, spaces, and hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 100) // Limit length

    return sanitized
  }
}