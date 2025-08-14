'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'react-hot-toast'
import { useProjectStore } from '@/stores/project-store'
import { LoadingButton } from '@/components/ui/loading'
import { formatRelativeTime, getErrorMessage } from '@/lib/utils'
import { apiClient } from '@/lib/api'
import { useProjectWebSocket } from '@/hooks/use-websocket'
import { TypingIndicator } from '@/components/stories/typing-indicator'
import { WEBSOCKET_EVENTS } from '@saga/shared'
import { transcriptAnalytics } from '@/services/transcript-analytics'

const interactionSchema = z.object({
  type: z.enum(['comment', 'question']),
  content: z.string().min(1, 'Content is required').max(500, 'Content must be less than 500 characters'),
})

type InteractionFormData = z.infer<typeof interactionSchema>

interface StoryData {
  id: string
  projectId: string
  title?: string
  audioUrl: string
  audioDuration?: number
  transcript?: string
  originalTranscript?: string
  photoUrl?: string
  aiPrompt?: string
  status: 'processing' | 'ready' | 'failed'
  createdAt?: string
  updatedAt?: string
  interactions?: Array<{
    id: string
    type: 'comment' | 'question'
    content: string
    createdAt?: string
    answeredAt?: string
    facilitatorName?: string
    facilitatorId?: string
  }>
}

export default function StoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const storyId = params.id as string
  
  const [story, setStory] = useState<StoryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState('')
  const [isSavingTranscript, setIsSavingTranscript] = useState(false)
  const [transcriptEditedBy, setTranscriptEditedBy] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isSubmittingInteraction, setIsSubmittingInteraction] = useState(false)
  
  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  // WebSocket for real-time updates
  const websocket = useProjectWebSocket(story?.projectId || null)
  
  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<Array<{ id: string; name: string }>>([])
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<InteractionFormData>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      type: 'comment',
    },
  })
  
  const interactionType = watch('type')

  useEffect(() => {
    if (storyId) {
      fetchStory()
    }
  }, [storyId])

  // WebSocket event handlers
  useEffect(() => {
    if (!story) return

    const unsubscribeInteraction = websocket.onInteractionAdded((data) => {
      if (data.storyId === story.id) {
        setStory(prevStory => {
          if (!prevStory) return prevStory
          return {
            ...prevStory,
            interactions: [
              ...(prevStory.interactions || []),
              {
                id: data.interaction.id,
                type: data.interaction.type,
                content: data.interaction.content,
                createdAt: data.interaction.createdAt,
                answeredAt: data.interaction.answeredAt,
                facilitatorName: data.facilitatorName,
                facilitatorId: data.interaction.facilitatorId,
              }
            ]
          }
        })
        
        // Show toast notification for new interactions from other facilitators
        const currentUserId = localStorage.getItem('userId') // Assuming we store user ID
        if (data.interaction.facilitatorId !== currentUserId) {
          toast.success(`${data.facilitatorName} added a ${data.interaction.type}`)
        }
      }
    })

    const unsubscribeTranscript = websocket.onTranscriptUpdated((data) => {
      if (data.storyId === story.id) {
        setStory(prevStory => {
          if (!prevStory) return prevStory
          return {
            ...prevStory,
            transcript: data.transcript
          }
        })
        toast.success('Transcript updated by another facilitator')
      }
    })

    const unsubscribeTypingStart = websocket.on(WEBSOCKET_EVENTS.TYPING_START, (data) => {
      if (data.storyId === story.id) {
        const currentUserId = localStorage.getItem('userId')
        if (data.userId !== currentUserId) {
          setTypingUsers(prev => {
            const exists = prev.find(user => user.id === data.userId)
            if (!exists) {
              return [...prev, { id: data.userId, name: data.userName }]
            }
            return prev
          })
        }
      }
    })

    const unsubscribeTypingStop = websocket.on(WEBSOCKET_EVENTS.TYPING_STOP, (data) => {
      if (data.storyId === story.id) {
        setTypingUsers(prev => prev.filter(user => user.id !== data.userId))
      }
    })

    return () => {
      unsubscribeInteraction()
      unsubscribeTranscript()
      unsubscribeTypingStart()
      unsubscribeTypingStop()
    }
  }, [story, websocket])

  const fetchStory = async () => {
    try {
      setIsLoading(true)
      const response = await apiClient.stories.get(storyId)
      setStory(response.data.data)
      setEditedTranscript(response.data.data.transcript || '')
    } catch (error) {
      console.error('Failed to fetch story:', error)
      toast.error('Failed to load story')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveTranscript = async (showToast = true) => {
    if (!story || !editedTranscript.trim()) return
    
    try {
      setIsSavingTranscript(true)
      
      const currentUserId = localStorage.getItem('userId') || 'unknown'
      const currentUserName = localStorage.getItem('userName') || 'Unknown User'
      const originalLength = story.transcript?.length || 0
      const editedLength = editedTranscript.trim().length
      
      const response = await apiClient.stories.update(story.id, {
        transcript: editedTranscript.trim(),
      })
      
      // Track transcript edit
      transcriptAnalytics.trackEditSave(
        story.id,
        story.projectId,
        currentUserId,
        currentUserName,
        originalLength,
        editedLength,
        showToast ? 'manual' : 'auto_save'
      )
      
      setStory({ 
        ...story, 
        transcript: editedTranscript.trim(),
        transcriptEditedBy: currentUserName,
        transcriptEditedAt: new Date().toISOString()
      })
      
      setTranscriptEditedBy(currentUserName)
      setLastSaved(new Date())
      
      if (showToast) {
        toast.success('Transcript updated successfully')
      }
    } catch (error) {
      console.error('Failed to update transcript:', error)
      
      // Track error
      const currentUserId = localStorage.getItem('userId') || 'unknown'
      transcriptAnalytics.trackEditError(
        story.id,
        currentUserId,
        error instanceof Error ? error.message : 'Unknown error'
      )
      
      if (showToast) {
        toast.error('Failed to update transcript')
      }
    } finally {
      setIsSavingTranscript(false)
    }
  }

  const handleAutoSave = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (editedTranscript !== story?.transcript) {
        handleSaveTranscript(false) // Auto-save without toast
      }
    }, 2000) // Auto-save after 2 seconds of inactivity
  }

  const handleTranscriptChange = (value: string) => {
    setEditedTranscript(value)
    handleAutoSave()
  }

  const onSubmitInteraction = async (data: InteractionFormData) => {
    if (!story) return
    
    try {
      setIsSubmittingInteraction(true)
      
      // Stop typing indicator
      handleTypingStop()
      
      const response = await apiClient.stories.addInteraction(story.id, data)
      
      setStory({
        ...story,
        interactions: [...(story.interactions || []), response.data],
      })
      
      reset()
      toast.success(`${data.type === 'comment' ? 'Comment' : 'Question'} added successfully`)
    } catch (error) {
      console.error('Failed to add interaction:', error)
      toast.error(`Failed to add ${data.type}`)
    } finally {
      setIsSubmittingInteraction(false)
    }
  }

  const handleTypingStart = () => {
    if (!story || !websocket.isConnected) return
    
    const currentUserId = localStorage.getItem('userId')
    const currentUserName = localStorage.getItem('userName') || 'Unknown User'
    
    websocket.emit(WEBSOCKET_EVENTS.TYPING_START, {
      storyId: story.id,
      projectId: story.projectId,
      userId: currentUserId,
      userName: currentUserName,
    })
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    // Auto-stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop()
    }, 3000)
  }

  const handleTypingStop = () => {
    if (!story || !websocket.isConnected) return
    
    const currentUserId = localStorage.getItem('userId')
    
    websocket.emit(WEBSOCKET_EVENTS.TYPING_STOP, {
      storyId: story.id,
      projectId: story.projectId,
      userId: currentUserId,
    })
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
  }

  // Audio player functions
  const togglePlayPause = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Story not found</h2>
        <p className="mt-2 text-gray-600">The story you're looking for doesn't exist.</p>
        <Link href="/dashboard/stories" className="mt-4 inline-block btn-primary">
          Back to Stories
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
          <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/stories" className="hover:text-gray-700">Stories</Link>
          <span>/</span>
          <span className="text-gray-900">{story.title || 'Untitled Story'}</span>
        </nav>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {story.title || 'Untitled Story'}
            </h1>
            <p className="mt-2 text-gray-600">
              Recorded {formatRelativeTime(story.createdAt)}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              story.status === 'ready'
                ? 'bg-green-100 text-green-800'
                : story.status === 'processing'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {story.status === 'ready' ? 'Ready' : story.status === 'processing' ? 'Processing' : 'Failed'}
            </span>
          </div>
        </div>
      </div>

      {/* Audio Player */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Audio Recording</h2>
          
          <div className="space-y-4">
            <audio
              ref={audioRef}
              src={story.audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              preload="metadata"
            />
            
            <div className="flex items-center space-x-4">
              <button
                onClick={togglePlayPause}
                className="flex items-center justify-center w-12 h-12 bg-primary-600 text-white rounded-full hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Transcript</h2>
              {transcriptEditedBy && (
                <p className="text-sm text-gray-500 mt-1">
                  Edited by {transcriptEditedBy}
                  {lastSaved && (
                    <span className="ml-2">
                      • Last saved {formatRelativeTime(lastSaved.toISOString())}
                    </span>
                  )}
                </p>
              )}
            </div>
            {story.transcript && (
              <button
                onClick={() => {
                  const newEditingState = !isEditingTranscript
                  setIsEditingTranscript(newEditingState)
                  
                  const currentUserId = localStorage.getItem('userId') || 'unknown'
                  const currentUserName = localStorage.getItem('userName') || 'Unknown User'
                  
                  if (newEditingState) {
                    // Starting to edit
                    transcriptAnalytics.trackEditStart(
                      story.id,
                      story.projectId,
                      currentUserId,
                      currentUserName
                    )
                  } else {
                    // Canceling edit
                    transcriptAnalytics.trackEditCancel(story.id, currentUserId)
                    setEditedTranscript(story.transcript || '')
                  }
                }}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                {isEditingTranscript ? 'Cancel Edit' : 'Edit Transcript'}
              </button>
            )}
          </div>
          
          {story.transcript ? (
            isEditingTranscript ? (
              <div className="space-y-4">
                <textarea
                  value={editedTranscript}
                  onChange={(e) => setEditedTranscript(e.target.value)}
                  rows={8}
                  className="input"
                  placeholder="Edit the transcript..."
                />
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {editedTranscript.length}/5000 characters
                  </p>
                  <div className="space-x-2">
                    <button
                      onClick={() => {
                        setIsEditingTranscript(false)
                        setEditedTranscript(story.transcript || '')
                      }}
                      className="btn-outline text-sm"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      onClick={async () => {
                        await handleSaveTranscript()
                        setIsEditingTranscript(false)
                        
                        // Track edit completion
                        const currentUserId = localStorage.getItem('userId') || 'unknown'
                        transcriptAnalytics.trackEditComplete(story.id, currentUserId)
                      }}
                      isLoading={isSavingTranscript}
                      className="btn-primary text-sm"
                    >
                      Save Changes
                    </LoadingButton>
                  </div>
                </div>
              </div>
            ) : (
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {story.transcript}
                </p>
              </div>
            )
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No transcript available</h3>
              <p className="mt-1 text-sm text-gray-500">
                The transcript will appear here once the audio is processed.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Interactions */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Interactions ({story.interactions?.length || 0})
          </h2>

          {/* Existing Interactions */}
          {story.interactions && story.interactions.length > 0 ? (
            <div className="space-y-4 mb-6">
              {story.interactions.filter(interaction => interaction.id && interaction.content).map((interaction) => (
                <div
                  key={interaction.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        interaction.type === 'comment'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {interaction.type === 'comment' ? 'Comment' : 'Follow-up Question'}
                      </span>
                      {interaction.facilitatorName && (
                        <span className="text-sm font-medium text-gray-700">
                          by {interaction.facilitatorName}
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        {formatRelativeTime(interaction.createdAt)}
                      </span>
                    </div>
                    {interaction.answeredAt && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Answered
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700">{interaction.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 mb-6">
              <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">No interactions yet</p>
            </div>
          )}

          {/* Add New Interaction */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Add Interaction</h3>
            
            <form onSubmit={handleSubmit(onSubmitInteraction)} className="space-y-4">
              {/* Interaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      {...register('type')}
                      type="radio"
                      value="comment"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Comment</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      {...register('type')}
                      type="radio"
                      value="question"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Follow-up Question</span>
                  </label>
                </div>
              </div>

              {/* Content */}
              <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                  {interactionType === 'comment' ? 'Comment' : 'Question'}
                </label>
                <textarea
                  {...register('content')}
                  rows={3}
                  className={`mt-1 input ${errors.content ? 'input-error' : ''}`}
                  placeholder={
                    interactionType === 'comment'
                      ? 'Share your thoughts about this story...'
                      : 'Ask a follow-up question to learn more...'
                  }
                  onFocus={handleTypingStart}
                  onBlur={handleTypingStop}
                  onChange={(e) => {
                    if (e.target.value.length > 0) {
                      handleTypingStart()
                    } else {
                      handleTypingStop()
                    }
                  }}
                />
                {errors.content && (
                  <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  {interactionType === 'comment'
                    ? 'Add a comment to share your thoughts or reactions to this story.'
                    : 'Ask a follow-up question that the storyteller can answer in a future recording.'
                  }
                </p>
                
                {/* Typing Indicator */}
                <TypingIndicator typingUsers={typingUsers} />
              </div>

              <div className="flex justify-end">
                <LoadingButton
                  type="submit"
                  isLoading={isSubmittingInteraction}
                  className="px-6"
                >
                  Add {interactionType === 'comment' ? 'Comment' : 'Question'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Story Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Story Actions</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 text-left">
                <p className="text-sm font-medium text-gray-900">Share Story</p>
                <p className="text-sm text-gray-500">Share with family members</p>
              </div>
            </button>

            <button className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 text-left">
                <p className="text-sm font-medium text-gray-900">Download Audio</p>
                <p className="text-sm text-gray-500">Save audio file locally</p>
              </div>
            </button>

            <button className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2M9 12h6m-6 4h6" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 text-left">
                <p className="text-sm font-medium text-gray-900">Export Transcript</p>
                <p className="text-sm text-gray-500">Download as text file</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Custom CSS for audio slider */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  )
}