'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  ChapterSummary, 
  ChapterAnalysisResult,
  CreateChapterSummaryInput,
  GetChapterSummariesResponse,
  CreateChapterSummaryResponse,
  AnalyzeStoriesForChaptersResponse
} from '@saga/shared'
import { apiClient } from '@/lib/api'

interface UseChapterSummariesOptions {
  projectId: string
  autoFetch?: boolean
}

export function useChapterSummaries({ projectId, autoFetch = true }: UseChapterSummariesOptions) {
  const [chapters, setChapters] = useState<ChapterSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch chapter summaries for the project
  const fetchChapters = useCallback(async () => {
    if (!projectId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await apiClient.get<GetChapterSummariesResponse>(
        `/projects/${projectId}/chapters`
      )

      if (response.data.success) {
        setChapters(response.data.data)
      } else {
        throw new Error('Failed to fetch chapters')
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to fetch chapters'
      setError(errorMessage)
      console.error('Failed to fetch chapters:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // Analyze stories for potential chapters
  const analyzeStories = useCallback(async (): Promise<ChapterAnalysisResult | null> => {
    if (!projectId) return null

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await apiClient.get<AnalyzeStoriesForChaptersResponse>(
        `/projects/${projectId}/chapters/analyze`
      )

      if (response.data.success) {
        return response.data.data
      } else {
        throw new Error('Failed to analyze stories')
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to analyze stories'
      setError(errorMessage)
      console.error('Failed to analyze stories:', err)
      return null
    } finally {
      setIsAnalyzing(false)
    }
  }, [projectId])

  // Create a new chapter summary
  const createChapter = useCallback(async (input: Omit<CreateChapterSummaryInput, 'projectId'>): Promise<ChapterSummary | null> => {
    if (!projectId) return null

    setIsCreating(true)
    setError(null)

    try {
      const response = await apiClient.post<CreateChapterSummaryResponse>(
        `/projects/${projectId}/chapters`,
        {
          ...input,
          projectId,
        }
      )

      if (response.data.success) {
        const newChapter = response.data.data
        setChapters(prev => [newChapter, ...prev])
        return newChapter
      } else {
        throw new Error('Failed to create chapter')
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to create chapter'
      setError(errorMessage)
      console.error('Failed to create chapter:', err)
      return null
    } finally {
      setIsCreating(false)
    }
  }, [projectId])

  // Auto-generate chapters
  const autoGenerateChapters = useCallback(async (): Promise<ChapterSummary[]> => {
    if (!projectId) return []

    setIsCreating(true)
    setError(null)

    try {
      const response = await apiClient.post<GetChapterSummariesResponse>(
        `/projects/${projectId}/chapters/auto-generate`
      )

      if (response.data.success) {
        const newChapters = response.data.data
        setChapters(prev => [...newChapters, ...prev])
        return newChapters
      } else {
        throw new Error('Failed to auto-generate chapters')
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to auto-generate chapters'
      setError(errorMessage)
      console.error('Failed to auto-generate chapters:', err)
      return []
    } finally {
      setIsCreating(false)
    }
  }, [projectId])

  // Update a chapter summary
  const updateChapter = useCallback(async (
    chapterId: string, 
    updates: {
      title?: string
      description?: string
      keyHighlights?: string[]
    }
  ): Promise<ChapterSummary | null> => {
    setError(null)

    try {
      const response = await apiClient.put<CreateChapterSummaryResponse>(
        `/chapters/${chapterId}`,
        updates
      )

      if (response.data.success) {
        const updatedChapter = response.data.data
        setChapters(prev => 
          prev.map(chapter => 
            chapter.id === chapterId ? updatedChapter : chapter
          )
        )
        return updatedChapter
      } else {
        throw new Error('Failed to update chapter')
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to update chapter'
      setError(errorMessage)
      console.error('Failed to update chapter:', err)
      return null
    }
  }, [])

  // Delete a chapter summary
  const deleteChapter = useCallback(async (chapterId: string): Promise<boolean> => {
    setError(null)

    try {
      await apiClient.delete(`/chapters/${chapterId}`)
      
      setChapters(prev => prev.filter(chapter => chapter.id !== chapterId))
      return true
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to delete chapter'
      setError(errorMessage)
      console.error('Failed to delete chapter:', err)
      return false
    }
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && projectId) {
      fetchChapters()
    }
  }, [autoFetch, projectId, fetchChapters])

  return {
    chapters,
    isLoading,
    isAnalyzing,
    isCreating,
    error,
    fetchChapters,
    analyzeStories,
    createChapter,
    autoGenerateChapters,
    updateChapter,
    deleteChapter,
    clearError,
  }
}