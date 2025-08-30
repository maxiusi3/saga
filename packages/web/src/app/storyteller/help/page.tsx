'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function StorytellerHelpPage() {
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'extra-large'>('normal')
  const [highContrast, setHighContrast] = useState(false)

  React.useEffect(() => {
    // Load accessibility preferences from localStorage
    const savedFontSize = localStorage.getItem('storyteller-font-size') as typeof fontSize
    const savedHighContrast = localStorage.getItem('storyteller-high-contrast') === 'true'
    
    if (savedFontSize) setFontSize(savedFontSize)
    if (savedHighContrast) setHighContrast(savedHighContrast)
  }, [])

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

      <div className=\"max-w-4xl mx-auto\">
        {/* Header */}
        <div className=\"text-center mb-8\">
          <h1 className=\"text-3xl md:text-4xl font-bold mb-4\">
            Help & Support
          </h1>
          <p className=\"text-lg text-gray-600\">
            Everything you need to know about sharing your stories
          </p>
        </div>

        {/* Getting Started */}
        <Card className={`p-6 mb-6 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-blue-50 border-blue-200'}`}>
          <h2 className=\"text-2xl font-bold mb-4\">Getting Started</h2>
          <div className=\"space-y-4\">
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">1. Read Today's Prompt</h3>
              <p>Each day, you'll see a new question or topic designed to help you remember and share your experiences. Take your time to think about it.</p>
            </div>
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">2. Click \"Start Recording\"</h3>
              <p>When you're ready, click the green recording button. You'll be asked to allow your browser to use your microphone.</p>
            </div>
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">3. Tell Your Story</h3>
              <p>Speak naturally and share as much or as little as you'd like. There's no time limit, but most stories are 2-10 minutes long.</p>
            </div>
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">4. Review and Send</h3>
              <p>After recording, you can listen to your story and re-record if needed. When you're happy with it, send it to your family.</p>
            </div>
          </div>
        </Card>

        {/* Recording Tips */}
        <Card className={`p-6 mb-6 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-green-50 border-green-200'}`}>
          <h2 className=\"text-2xl font-bold mb-4\">Recording Tips</h2>
          <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">🎤 Good Audio Quality</h3>
              <ul className=\"space-y-1 text-sm\">
                <li>• Find a quiet room</li>
                <li>• Speak clearly and at normal volume</li>
                <li>• Stay close to your device</li>
                <li>• Avoid background noise</li>
              </ul>
            </div>
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">💭 Story Ideas</h3>
              <ul className=\"space-y-1 text-sm\">
                <li>• Share specific memories</li>
                <li>• Include names, dates, and places</li>
                <li>• Describe how things made you feel</li>
                <li>• Don't worry about being perfect</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Technical Help */}
        <Card className={`p-6 mb-6 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-yellow-50 border-yellow-200'}`}>
          <h2 className=\"text-2xl font-bold mb-4\">Technical Help</h2>
          <div className=\"space-y-4\">
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">Microphone Not Working?</h3>
              <ul className=\"space-y-1 text-sm\">
                <li>• Make sure you clicked \"Allow\" when asked for microphone permission</li>
                <li>• Check that your microphone is plugged in and working</li>
                <li>• Try refreshing the page and starting again</li>
                <li>• Make sure no other apps are using your microphone</li>
              </ul>
            </div>
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">Can't See the Text Clearly?</h3>
              <ul className=\"space-y-1 text-sm\">
                <li>• Use the \"Font Size\" dropdown at the top of the page</li>
                <li>• Try the \"High Contrast\" button for better visibility</li>
                <li>• You can also zoom in using your browser (Ctrl/Cmd and +)</li>
              </ul>
            </div>
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">Recording Didn't Save?</h3>
              <ul className=\"space-y-1 text-sm\">
                <li>• Make sure you clicked \"Send to Family\" after recording</li>
                <li>• Check your internet connection</li>
                <li>• Try recording a shorter story (under 10 minutes)</li>
                <li>• Contact support if the problem continues</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Contact Support */}
        <Card className={`p-6 mb-6 ${highContrast ? 'bg-gray-800 border-gray-600' : 'bg-red-50 border-red-200'}`}>
          <h2 className=\"text-2xl font-bold mb-4\">Need More Help?</h2>
          <div className=\"space-y-4\">
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">Contact Your Family</h3>
              <p>The family member who invited you to Saga can help with any questions about your project or stories.</p>
            </div>
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">Email Support</h3>
              <p>For technical issues, you can email us at:</p>
              <a 
                href=\"mailto:support@saga.family\" 
                className=\"text-blue-600 hover:text-blue-800 font-medium\"
              >
                support@saga.family
              </a>
            </div>
            <div>
              <h3 className=\"text-lg font-semibold mb-2\">Phone Support</h3>
              <p>Call us during business hours (9 AM - 5 PM EST):</p>
              <a 
                href=\"tel:+1-555-SAGA-HELP\" 
                className=\"text-blue-600 hover:text-blue-800 font-medium text-lg\"
              >
                1-555-SAGA-HELP
              </a>
            </div>
          </div>
        </Card>

        {/* Back to Dashboard */}
        <div className=\"text-center\">
          <Button
            onClick={() => window.location.href = '/storyteller'}
            size=\"lg\"
            className=\"bg-blue-600 hover:bg-blue-700 text-white px-8 py-3\"
          >
            ← Back to Your Stories
          </Button>
        </div>
      </div>
    </div>
  )
}