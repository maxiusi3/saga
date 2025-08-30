'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface StorytellerDashboardProps {
  projectId: string
  userId: string
}

interface AIPrompt {
  id: string
  text: string
  audioUrl?: string
  chapterName?: string
}

interface FamilyFeedback {
  id: string
  storyId: string
  message: string
  createdAt: string
  facilitatorName: string
}

export function StorytellerDashboard({ projectId, userId }: StorytellerDashboardProps) {
  const router = useRouter()
  const [currentPrompt, setCurrentPrompt] = useState<AIPrompt | null>(null)
  const [recentFeedback, setRecentFeedback] = useState<FamilyFeedback[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'extra-large'>('normal')
  const [highContrast, setHighContrast] = useState(false)

  useEffect(() => {
    loadDashboardData()
    // Load accessibility preferences from localStorage
    const savedFontSize = localStorage.getItem('storyteller-font-size') as typeof fontSize
    const savedHighContrast = localStorage.getItem('storyteller-high-contrast') === 'true'
    
    if (savedFontSize) setFontSize(savedFontSize)
    if (savedHighContrast) setHighContrast(savedHighContrast)
  }, [projectId, userId])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      
      // Load current AI prompt
      const promptResponse = await api.get(`/prompts/next/${projectId}`)
      if (promptResponse.data?.prompt) {
        setCurrentPrompt(promptResponse.data.prompt)
      }

      // Load recent family feedback
      const feedbackResponse = await api.get(`/projects/${projectId}/feedback/recent`)
      if (feedbackResponse.data?.feedback) {
        setRecentFeedback(feedbackResponse.data.feedback)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
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

  const startRecording = () => {
    if (currentPrompt) {
      router.push(`/storyteller/record?projectId=${projectId}&promptId=${currentPrompt.id}`)
    }
  }

  const playPromptAudio = () => {
    if (currentPrompt?.audioUrl) {
      const audio = new Audio(currentPrompt.audioUrl)
      audio.play().catch(error => {
        console.error('Failed to play audio:', error)
      })
    }
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

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${getContrastClass()}`}>
        <div className=\"text-center\">
          <div className=\"animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4\"></div>
          <p className={`${getFontSizeClass()}`}>Loading your stories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen p-4 ${getContrastClass()} ${getFontSizeClass()}`}>
      {/* Accessibility Controls */}
      <div className=\"mb-6 flex flex-wrap gap-4 justify-end\">
        <div className=\"flex items-center gap-2\">
          <label className=\"text-sm font-medium\">Font Size:</label>
          <select 
            value={fontSize} 
            onChange={(e) => handleFontSizeChange(e.target.value as typeof fontSize)}
            className={`px-3 py-1 border rounded ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}
          >
            <option value=\"normal\">Normal</option>
            <option value=\"large\">Large</option>
            <option value=\"extra-large\">Extra Large</option>
          </select>
        </div>
        <Button
          onClick={handleHighContrastToggle}
          variant={highContrast ? \"default\" : \"outline\"}
          size=\"sm\"
        >
          {highContrast ? 'Normal Contrast' : 'High Contrast'}
        </Button>
      </div>

      {/* Welcome Header */}
      <div className=\"text-center mb-8\">
        <h1 className=\"text-3xl md:text-4xl font-bold mb-4\">
          Welcome to Your Story Space
        </h1>
        <p className=\"text-lg md:text-xl text-gray-600 max-w-2xl mx-auto\">
          Share your memories and experiences with your family. Each story you tell becomes a treasured part of your family's history.
        </p>
      </div>

      <div className=\"max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6\">
        {/* Current AI Prompt */}
        <Card className={`p-6 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-blue-50 border-blue-200'}`}>
          <h2 className=\"text-2xl font-bold mb-4 text-center\">
            Today's Story Prompt
          </h2>
          
          {currentPrompt ? (
            <div className=\"space-y-4\">
              {currentPrompt.chapterName && (
                <div className={`text-sm font-medium px-3 py-1 rounded-full inline-block ${
                  highContrast ? 'bg-gray-700 text-gray-200' : 'bg-blue-100 text-blue-800'
                }`}>
                  {currentPrompt.chapterName}
                </div>
              )}
              
              <div className={`p-4 rounded-lg ${
                highContrast ? 'bg-gray-700' : 'bg-white'
              } border-l-4 border-blue-500`}>
                <p className=\"text-lg leading-relaxed mb-4\">
                  {currentPrompt.text}
                </p>
                
                {currentPrompt.audioUrl && (
                  <Button
                    onClick={playPromptAudio}
                    variant=\"outline\"
                    size=\"sm\"
                    className=\"mb-4\"
                  >
                    🔊 Listen to Prompt
                  </Button>
                )}
              </div>

              <div className=\"text-center\">
                <Button
                  onClick={startRecording}
                  size=\"lg\"
                  className=\"text-xl px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg\"
                >
                  🎤 Start Recording Your Story
                </Button>
              </div>
            </div>
          ) : (
            <div className=\"text-center py-8\">
              <p className=\"text-lg text-gray-600 mb-4\">
                No new prompts available right now.
              </p>
              <Button
                onClick={loadDashboardData}
                variant=\"outline\"
              >
                Check for New Prompts
              </Button>
            </div>
          )}
        </Card>

        {/* Family Feedback */}
        <Card className={`p-6 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-green-50 border-green-200'}`}>
          <h2 className=\"text-2xl font-bold mb-4 text-center\">
            Messages from Family
          </h2>
          
          {recentFeedback.length > 0 ? (
            <div className=\"space-y-4 max-h-96 overflow-y-auto\">
              {recentFeedback.map((feedback) => (
                <div 
                  key={feedback.id}
                  className={`p-4 rounded-lg ${
                    highContrast ? 'bg-gray-700' : 'bg-white'
                  } border-l-4 border-green-500`}
                >
                  <div className=\"flex justify-between items-start mb-2\">
                    <span className=\"font-medium text-green-700\">
                      {feedback.facilitatorName}
                    </span>
                    <span className=\"text-sm text-gray-500\">
                      {new Date(feedback.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className=\"leading-relaxed\">
                    {feedback.message}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className=\"text-center py-8\">
              <p className=\"text-lg text-gray-600 mb-4\">
                No recent messages from family.
              </p>
              <p className=\"text-sm text-gray-500\">
                Your family will see your stories and can send you messages and questions.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <div className=\"max-w-4xl mx-auto mt-8\">
        <Card className={`p-6 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-gray-50'}`}>
          <h2 className=\"text-xl font-bold mb-4 text-center\">Quick Actions</h2>
          <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
            <Button
              onClick={() => router.push(`/storyteller/stories?projectId=${projectId}`)}
              variant=\"outline\"
              size=\"lg\"
              className=\"h-16\"
            >
              📚 View My Stories
            </Button>
            <Button
              onClick={() => router.push(`/storyteller/help`)}
              variant=\"outline\"
              size=\"lg\"
              className=\"h-16\"
            >
              ❓ Get Help
            </Button>
            <Button
              onClick={() => router.push(`/storyteller/settings?projectId=${projectId}`)}
              variant=\"outline\"
              size=\"lg\"
              className=\"h-16\"
            >
              ⚙️ Settings
            </Button>
          </div>
        </Card>
      </div>

      {/* Instructions */}
      <div className=\"max-w-4xl mx-auto mt-8\">
        <Card className={`p-6 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-yellow-50 border-yellow-200'}`}>
          <h2 className=\"text-xl font-bold mb-4 text-center\">How It Works</h2>
          <div className=\"grid grid-cols-1 md:grid-cols-3 gap-6 text-center\">
            <div>
              <div className=\"text-3xl mb-2\">1️⃣</div>
              <h3 className=\"font-bold mb-2\">Read the Prompt</h3>
              <p className=\"text-sm\">Each day, you'll see a new question or topic to help spark your memories.</p>
            </div>
            <div>
              <div className=\"text-3xl mb-2\">2️⃣</div>
              <h3 className=\"font-bold mb-2\">Record Your Story</h3>
              <p className=\"text-sm\">Click the record button and share your memories in your own words.</p>
            </div>
            <div>
              <div className=\"text-3xl mb-2\">3️⃣</div>
              <h3 className=\"font-bold mb-2\">Connect with Family</h3>
              <p className=\"text-sm\">Your family can listen to your stories and send you messages.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}