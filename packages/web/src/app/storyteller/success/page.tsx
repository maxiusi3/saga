'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function StorytellerSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [projectId, setProjectId] = useState<string | null>(null)
  const [storyId, setStoryId] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'extra-large'>('normal')
  const [highContrast, setHighContrast] = useState(false)

  useEffect(() => {
    const urlProjectId = searchParams.get('projectId')
    const urlStoryId = searchParams.get('storyId')
    
    setProjectId(urlProjectId)
    setStoryId(urlStoryId)

    // Load accessibility preferences
    const savedFontSize = localStorage.getItem('storyteller-font-size') as typeof fontSize
    const savedHighContrast = localStorage.getItem('storyteller-high-contrast') === 'true'
    
    if (savedFontSize) setFontSize(savedFontSize)
    if (savedHighContrast) setHighContrast(savedHighContrast)
  }, [searchParams])

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

      <div className=\"max-w-4xl mx-auto text-center\">
        {/* Success Animation */}
        <div className=\"mb-8\">
          <div className=\"text-8xl mb-4 animate-bounce\">🎉</div>
          <h1 className=\"text-4xl md:text-5xl font-bold mb-4 text-green-600\">
            Story Sent Successfully!
          </h1>
          <p className=\"text-xl md:text-2xl text-gray-600\">
            Your family will be notified about your new story
          </p>
        </div>

        {/* Success Details */}
        <Card className={`p-8 mb-8 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-green-50 border-green-200'}`}>
          <div className=\"space-y-6\">
            <div>
              <h2 className=\"text-2xl font-bold mb-4\">What Happens Next?</h2>
              <div className=\"grid grid-cols-1 md:grid-cols-3 gap-6\">
                <div className=\"text-center\">
                  <div className=\"text-4xl mb-3\">📧</div>
                  <h3 className=\"font-bold mb-2\">Family Notified</h3>
                  <p className=\"text-sm\">Your family members will receive an email letting them know you've shared a new story.</p>
                </div>
                <div className=\"text-center\">
                  <div className=\"text-4xl mb-3\">👂</div>
                  <h3 className=\"font-bold mb-2\">They Listen</h3>
                  <p className=\"text-sm\">Your family can listen to your story and see the transcript on their dashboard.</p>
                </div>
                <div className=\"text-center\">
                  <div className=\"text-4xl mb-3\">💬</div>
                  <h3 className=\"font-bold mb-2\">They Respond</h3>
                  <p className=\"text-sm\">Family members can send you messages, ask follow-up questions, or share their own memories.</p>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-lg ${
              highContrast ? 'bg-gray-700' : 'bg-white'
            } border-l-4 border-green-500`}>
              <p className=\"font-medium text-green-800\">
                ✅ Your story has been saved and will be included in your family's permanent collection.
              </p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className=\"space-y-4 mb-8\">
          <div className=\"flex flex-col sm:flex-row gap-4 justify-center\">
            <Button
              onClick={() => router.push('/storyteller')}
              size=\"lg\"
              className=\"bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg\"
            >
              📚 Back to Dashboard
            </Button>
            <Button
              onClick={() => router.push(`/storyteller/record?projectId=${projectId}`)}
              size=\"lg\"
              variant=\"outline\"
              className=\"px-8 py-4 text-lg\"
            >
              🎤 Record Another Story
            </Button>
          </div>
          
          {projectId && (
            <Button
              onClick={() => router.push(`/storyteller/stories?projectId=${projectId}`)}
              variant=\"outline\"
              size=\"sm\"
            >
              View All My Stories
            </Button>
          )}
        </div>

        {/* Encouragement Message */}
        <Card className={`p-6 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-blue-50 border-blue-200'}`}>
          <h3 className=\"text-xl font-bold mb-3\">Thank You for Sharing!</h3>
          <p className=\"text-gray-600 leading-relaxed\">
            Every story you share becomes a treasured part of your family's history. 
            Your memories, experiences, and wisdom are gifts that will be cherished for generations to come.
          </p>
          <div className=\"mt-4 text-sm text-gray-500\">
            <p>💡 Tip: Check back tomorrow for a new story prompt!</p>
          </div>
        </Card>

        {/* Quick Stats (if available) */}
        <div className=\"mt-8 text-center\">
          <p className=\"text-sm text-gray-500\">
            This is your story #{storyId ? storyId.slice(-6) : '...'} in this project
          </p>
        </div>
      </div>
    </div>
  )
}