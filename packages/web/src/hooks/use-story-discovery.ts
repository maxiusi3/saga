import { useState, useEffect } from 'react'
import { 
  StoryRecommendation, 
  StoryInsights, 
  StoryTimeline, 
  StoryQualityMetrics,
  Story,
  DiscoveryFilters 
} from '@saga/shared'
import { apiClient } from '@/lib/api'

export function useStoryRecommendations(projectId: string, limit = 10) {
  const [recommendations, setRecommendations] = useState<StoryRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecommendations = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await apiClient.get(`/api/projects/${projectId}/recommendations`, {
        params: { limit }
      })
      
      setRecommendations(response.data.data.recommendations)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load recommendations')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) {
      fetchRecommendations()
    }
  }, [projectId, limit])

  return {
    recommendations,
    isLoading,
    error,
    refetch: fetchRecommendations
  }
}

export function useRelatedStories(storyId: string, limit = 5) {
  const [relatedStories, setRelatedStories] = useState<Story[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRelatedStories = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await apiClient.get(`/api/stories/${storyId}/related`, {
        params: { limit }
      })
      
      setRelatedStories(response.data.data.relatedStories)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load related stories')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (storyId) {
      fetchRelatedStories()
    }
  }, [storyId, limit])

  return {
    relatedStories,
    isLoading,
    error,
    refetch: fetchRelatedStories
  }
}

export function useStoryTimeline(projectId: string, filters: DiscoveryFilters = {}) {
  const [timeline, setTimeline] = useState<StoryTimeline | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTimeline = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await apiClient.get(`/api/projects/${projectId}/timeline`, {
        params: filters
      })
      
      setTimeline(response.data.data)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load timeline')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) {
      fetchTimeline()
    }
  }, [projectId, JSON.stringify(filters)])

  return {
    timeline,
    isLoading,
    error,
    refetch: fetchTimeline
  }
}

export function useStoryInsights(projectId: string) {
  const [insights, setInsights] = useState<StoryInsights | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await apiClient.get(`/api/projects/${projectId}/insights`)
      
      setInsights(response.data.data)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load insights')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) {
      fetchInsights()
    }
  }, [projectId])

  return {
    insights,
    isLoading,
    error,
    refetch: fetchInsights
  }
}

export function useStoryFavorites(projectId?: string) {
  const [favorites, setFavorites] = useState<Story[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFavorites = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await apiClient.get('/api/users/favorites', {
        params: projectId ? { projectId } : {}
      })
      
      setFavorites(response.data.data.favorites)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load favorites')
    } finally {
      setIsLoading(false)
    }
  }

  const addToFavorites = async (storyId: string) => {
    try {
      await apiClient.post(`/api/stories/${storyId}/favorite`)
      await fetchFavorites() // Refresh the list
    } catch (err: any) {
      throw new Error(err.response?.data?.error?.message || 'Failed to add to favorites')
    }
  }

  const removeFromFavorites = async (storyId: string) => {
    try {
      await apiClient.delete(`/api/stories/${storyId}/favorite`)
      await fetchFavorites() // Refresh the list
    } catch (err: any) {
      throw new Error(err.response?.data?.error?.message || 'Failed to remove from favorites')
    }
  }

  const isFavorite = (storyId: string) => {
    return favorites.some(story => story.id === storyId)
  }

  useEffect(() => {
    fetchFavorites()
  }, [projectId])

  return {
    favorites,
    isLoading,
    error,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    refetch: fetchFavorites
  }
}

export function useStoryQuality(storyId: string) {
  const [qualityMetrics, setQualityMetrics] = useState<StoryQualityMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQualityMetrics = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await apiClient.get(`/api/stories/${storyId}/quality`)
      
      setQualityMetrics(response.data.data)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load quality metrics')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (storyId) {
      fetchQualityMetrics()
    }
  }, [storyId])

  return {
    qualityMetrics,
    isLoading,
    error,
    refetch: fetchQualityMetrics
  }
}