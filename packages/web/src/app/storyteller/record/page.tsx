'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { WebAudioRecorder } from '@/components/recording/WebAudioRecorder'
import { RecordingDraftRecovery } from '@/components/recording/RecordingDraftRecovery'
import { MobileRecordingOptimizer } from '@/components/recording/MobileRecordingOptimizer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

interface AIPrompt {
  id: string
  text: string
  audioUrl?: string
  chapterName?: string
}

// Component that uses useSearchParams - needs to be wrapped in Suspense
function StorytellerRecordPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  
  const [projectId, setProjectId] = useState<string | null>(null)
  const [promptId, setPromptId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<AIPrompt | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'extra-large'>('normal')
  const [highContrast, setHighContrast] = useState(false)
  const [showDraftRecovery, setShowDraftRecovery] = useState(true)
  const [hasDraftRecovered, setHasDraftRecovered] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/signin?redirect=/storyteller/record')
      return
    }

    const urlProjectId = searchParams.get('projectId')
    const urlPromptId = searchParams.get('promptId')
    
    if (urlProjectId && urlPromptId) {
      setProjectId(urlProjectId)
      setPromptId(urlPromptId)
      loadPrompt(urlProjectId, urlPromptId)
    } else {
      setError('Missing project or prompt information')
      setIsLoading(false)
    }

    // Load accessibility preferences
    const savedFontSize = localStorage.getItem('storyteller-font-size') as typeof fontSize
    const savedHighContrast = localStorage.getItem('storyteller-high-contrast') === 'true'
    
    if (savedFontSize) setFontSize(savedFontSize)
    if (savedHighContrast) setHighContrast(savedHighContrast)
  }, [isAuthenticated, searchParams, router])

  const loadPrompt = async (projectId: string, promptId: string) => {
    try {
      setIsLoading(true)
      const response = await api.get(`/prompts/${promptId}?projectId=${projectId}`)
      
      if (response.data?.prompt) {
        setPrompt(response.data.prompt)
      } else {
        setError('Prompt not found')
      }
    } catch (err: any) {
      console.error('Failed to load prompt:', err)
      setError('Failed to load prompt. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecordingComplete = (audioBlob: Blob, duration: number) => {
    setRecordingBlob(audioBlob)
    setRecordingDuration(duration)
  }

  const handleDraftRecovered = (draft: any) => {
    setRecordingBlob(draft.audioBlob)
    setRecordingDuration(draft.duration)
    setShowDraftRecovery(false)
    setHasDraftRecovered(true)
  }

  const handleDraftDiscarded = () => {
    setShowDraftRecovery(false)
  }

  const handleRecordingError = (errorMessage: string) => {
    setError(errorMessage)
  }

  const handleSendToFamily = async () => {
    if (!recordingBlob || !projectId || !promptId || !user) {
      setError('Missing recording or project information')
      return
    }

    try {
      setIsUploading(true)
      setError(null)

      // Create FormData for file upload
      const formData = new FormData()
      formData.append('audio', recordingBlob, 'story.webm')
      formData.append('projectId', projectId)
      formData.append('promptId', promptId)
      formData.append('duration', recordingDuration.toString())

      const response = await api.post('/stories/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data?.success) {
        // Success! Redirect to success page
        router.push(`/storyteller/success?projectId=${projectId}&storyId=${response.data.story.id}`)
      } else {
        setError('Failed to upload story. Please try again.')
      }
    } catch (err: any) {
      console.error('Failed to upload story:', err)
      setError(err.response?.data?.error || 'Failed to upload story. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const playPromptAudio = () => {
    if (prompt?.audioUrl) {
      const audio = new Audio(prompt.audioUrl)
      audio.play().catch(error => {
        console.error('Failed to play audio:', error)
      })
    }
  }

  const handleFontSizeChange = (newSize: typeof fontSize) => {
    setFontSize(newSize)
    localStorage.setItem('storyteller-font-size', newSize)
  }

  const handleHighContrastToggle = () => {
    const newValue = !highContrast
    setHighContrast(newValue)
    localStorage.setItem('storyteller-high-contrast', newValue.toString())
  }

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'large': return 'text-lg'
      case 'extra-large': return 'text-xl'
      default: return 'text-base'
    }
  }

  const getContrastClass = () => {
    return highContrast ? 'bg-black text-white' : 'bg-white text-gray-900'
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Redirecting to sign in...</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg">Loading your story prompt...</p>
        </div>
      </div>
    )
  }

  if (error && !prompt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button
            onClick={() => router.push('/storyteller')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <MobileRecordingOptimizer>
      <div className={`min-h-screen p-4 ${getContrastClass()} ${getFontSizeClass()}`}>
      {/* Accessibility Controls */}
      <div className="mb-6 flex flex-wrap gap-4 justify-between items-center">
        <Button
          onClick={() => router.push('/storyteller')}
          variant="outline"
          size="sm"
        >
          ← Back to Dashboard
        </Button>
        
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Font Size:</label>
            <select 
              value={fontSize} 
              onChange={(e) => handleFontSizeChange(e.target.value as typeof fontSize)}
              className={`px-3 py-1 border rounded ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}
            >
              <option value="normal">Normal</option>
              <option value="large">Large</option>
              <option value="extra-large">Extra Large</option>
            </select>
          </div>
          <Button
            onClick={handleHighContrastToggle}
            variant={highContrast ? "default" : "outline"}
            size="sm"
          >
            {highContrast ? 'Normal Contrast' : 'High Contrast'}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Record Your Story
          </h1>
          <p className="text-lg text-gray-600">
            Take your time and share your memories in your own words
          </p>
        </div>

        {/* Current Prompt */}
        {prompt && (
          <Card className={`p-6 mb-8 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-blue-50 border-blue-200'}`}>
            <h2 className="text-2xl font-bold mb-4 text-center">
              Today's Prompt
            </h2>
            
            {prompt.chapterName && (
              <div className={`text-sm font-medium px-3 py-1 rounded-full inline-block mb-4 ${
                highContrast ? 'bg-gray-700 text-gray-200' : 'bg-blue-100 text-blue-800'
              }`}>
                {prompt.chapterName}
              </div>
            )}
            
            <div className={`p-4 rounded-lg ${
              highContrast ? 'bg-gray-700' : 'bg-white'
            } border-l-4 border-blue-500 mb-4`}>
              <p className="text-lg leading-relaxed">
                {prompt.text}
              </p>
            </div>
            
            {prompt.audioUrl && (
              <div className="text-center">
                <Button
                  onClick={playPromptAudio}
                  variant="outline"
                  size="sm"
                >
                  🔊 Listen to Prompt
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Draft Recovery */}
        {showDraftRecovery && projectId && promptId && (
          <div className="mb-8">
            <RecordingDraftRecovery
              projectId={projectId}
              promptId={promptId}
              onDraftRecovered={handleDraftRecovered}
              onDraftDiscarded={handleDraftDiscarded}
            />
          </div>
        )}

        {/* Recording Component */}
        {(!showDraftRecovery || hasDraftRecovered) && (
          <div className="mb-8">
            <WebAudioRecorder
              onRecordingComplete={handleRecordingComplete}
              onError={handleRecordingError}
              maxDuration={600} // 10 minutes
              className={highContrast ? 'bg-gray-800 border-gray-600' : ''}
              projectId={projectId || undefined}
              promptId={promptId || undefined}
              promptText={prompt?.text}
              enableDraftSaving={true}
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Card className="p-4 mb-6 bg-red-50 border-red-200">
            <div className="flex items-center space-x-2 text-red-800">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          </Card>
        )}

        {/* Send to Family Button */}
        {recordingBlob && (
          <Card className={`p-6 text-center ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-green-50 border-green-200'}`}>
            <h3 className="text-xl font-bold mb-4">Ready to Share?</h3>
            <p className="text-gray-600 mb-6">
              Your story is ready! Click below to send it to your family.
            </p>
            <Button
              onClick={handleSendToFamily}
              disabled={isUploading}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg font-bold"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Sending to Family...
                </>
              ) : (
                '💌 Send to Family'
              )}
            </Button>
          </Card>
        )}

        {/* Recording Tips */}
        <Card className={`p-6 mt-8 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-yellow-50 border-yellow-200'}`}>
          <h3 className="text-lg font-bold mb-3">Recording Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">🎤 For Best Audio Quality:</h4>
              <ul className="space-y-1">
                <li>• Find a quiet room</li>
                <li>• Speak clearly and at normal volume</li>
                <li>• Stay close to your device</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">💭 Storytelling Tips:</h4>
              <ul className="space-y-1">
                <li>• Include specific details and names</li>
                <li>• Share how things made you feel</li>
                <li>• Don't worry about being perfect</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
    </MobileRecordingOptimizer>
  )
}

// Loading component for Suspense fallback
function StorytellerRecordPageLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-600">Loading your story prompt...</p>
      </div>
    </div>
  )
}

// Main export with Suspense boundary
export default function StorytellerRecordPage() {
  return (
    <Suspense fallback={<StorytellerRecordPageLoading />}>
      <StorytellerRecordPageContent />
    </Suspense>
  )
}