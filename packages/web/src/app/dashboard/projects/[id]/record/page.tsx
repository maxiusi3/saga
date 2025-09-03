'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Send, Sparkles, ArrowLeft } from 'lucide-react'
import { StoryPrompt, getNextPrompt, getPromptById, AI_PROMPT_CHAPTERS } from '@saga/shared'
import { AudioRecorder } from '@/components/audio/AudioRecorder'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { storyService } from '@/lib/stories'
import { useAuthStore } from '@/stores/auth-store'
import { aiService, AIContent } from '@/lib/ai-service'
import { toast } from 'react-hot-toast'

interface AIContent {
  title?: string
  summary?: string
  transcript?: string
  followUpQuestions?: string[]
  confidence?: number
}

export default function ProjectRecordPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const projectId = params.id as string
  
  // Story states
  const [currentPrompt, setCurrentPrompt] = useState<StoryPrompt | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)

  // AI states
  const [aiProcessing, setAiProcessing] = useState(false)
  const [aiProgress, setAiProgress] = useState(0)
  const [aiContent, setAiContent] = useState<AIContent | null>(null)

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // AI service status
  const [aiServiceStatus, setAiServiceStatus] = useState<{ available: boolean; mode: 'production' | 'mock' } | null>(null)

  // Load initial prompt and check AI service status
  useEffect(() => {
    const prompt = getNextPrompt()
    setCurrentPrompt(prompt)

    // Check AI service status
    const status = aiService.getServiceStatus()
    setAiServiceStatus(status)

    if (status.mode === 'mock') {
      console.log('AI service running in mock mode - no OpenAI API key configured')
    }
  }, [])

  // Handle recording completion
  const handleRecordingComplete = (blob: Blob, duration: number) => {
    setAudioBlob(blob)
    setAudioUrl(URL.createObjectURL(blob))
    setRecordingDuration(duration)

    // Start AI processing
    processAudioWithAI(blob)
  }

  // Process audio with AI using real AI service
  const processAudioWithAI = async (audioBlob: Blob) => {
    setAiProcessing(true)
    setAiProgress(0)

    try {
      // Use real AI service to process audio
      const aiContent = await aiService.processAudioWithAI(
        audioBlob,
        currentPrompt?.text,
        {
          onProgress: (step, progress) => {
            setAiProgress(progress)
            console.log(`AI Processing: ${step} (${progress}%)`)
          }
        }
      )

      setAiContent(aiContent)
      toast.success('AI processing completed successfully!')
    } catch (error) {
      console.error('AI processing failed:', error)

      // Fallback to basic content if AI fails
      setAiContent({
        title: "Untitled Story",
        summary: "AI processing failed. Please add a title and description manually.",
        transcript: "Transcript generation failed. Please try again or add content manually.",
        followUpQuestions: [
          "Can you tell me more about this experience?",
          "What was most memorable about this moment?",
          "How did this experience affect you?"
        ],
        confidence: 0
      })

      toast.error('AI processing failed. You can still save your story manually.')
    } finally {
      setAiProcessing(false)
    }
  }

  // Handle story submission
  const handleSubmitStory = async () => {
    if (!audioBlob || !aiContent || !user?.id) {
      setSubmitError('Missing required data for story submission.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Create story in database
      const story = await storyService.createStory({
        project_id: projectId,
        storyteller_id: user.id,
        title: aiContent.title,
        content: aiContent.summary,
        audio_blob: audioBlob,
        transcript: aiContent.transcript,
        ai_generated_title: aiContent.title,
        ai_summary: aiContent.summary,
        ai_follow_up_questions: aiContent.followUpQuestions,
        ai_confidence_score: aiContent.confidence
      })

      if (!story) {
        throw new Error('Failed to create story')
      }

      // Show success message
      toast.success('Story saved successfully!')

      // Redirect to project page on success
      router.push(`/dashboard/projects/${projectId}`)
    } catch (error) {
      console.error('Story submission failed:', error)
      setSubmitError('Failed to save story. Please try again.')
      toast.error('Failed to save story')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset recording and start over
  const handleStartOver = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingDuration(0)
    setAiContent(null)
    setAiProcessing(false)
    setAiProgress(0)
    setSubmitError(null)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])



  const playPrompt = () => {
    if (currentPrompt) {
      // This would play the AI-generated audio prompt
      // For now, we'll use text-to-speech or show a placeholder
      console.log('Playing prompt:', currentPrompt.text)
    }
  }

  if (!currentPrompt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-furbridge-teal"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Record Your Story</h1>
          <p className="text-gray-600">Share your memories with AI-powered guidance</p>
        </div>

        {/* Current Prompt */}
        <FurbridgeCard className="p-6 bg-gradient-to-r from-furbridge-teal/10 to-furbridge-orange/10 border-2 border-furbridge-teal/20">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Badge className="bg-furbridge-teal text-white">
                  {currentPrompt.category}
                </Badge>
                <Badge variant="outline" className="text-furbridge-orange border-furbridge-orange">
                  ~{currentPrompt.estimatedTime} min
                </Badge>
              </div>
              <FurbridgeButton
                variant="outline"
                size="sm"
                onClick={playPrompt}
                className="border-furbridge-teal text-furbridge-teal hover:bg-furbridge-teal hover:text-white"
              >
                <Volume2 className="h-4 w-4 mr-2" />
                Listen to Prompt
              </FurbridgeButton>
            </div>
            
            <div className="bg-white/50 rounded-lg p-4">
              <p className="text-lg text-gray-800 leading-relaxed">
                {currentPrompt.text}
              </p>
            </div>

            {currentPrompt.followUpSuggestions && currentPrompt.followUpSuggestions.length > 0 && (
              <div className="bg-white/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  💡 Consider exploring:
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {currentPrompt.followUpSuggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-furbridge-orange">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </FurbridgeCard>

        {/* Recording Interface */}
        <AudioRecorder
          onRecordingComplete={handleRecordingComplete}
          onRecordingStart={() => console.log('Recording started')}
          onRecordingStop={() => console.log('Recording stopped')}
          className="w-full"
        />

        {/* Audio Preview */}
        {audioUrl && !aiProcessing && (
          <FurbridgeCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview Your Recording</h3>
            <AudioPlayer
              src={audioUrl}
              title="Your Story Recording"
              className="w-full"
            />
            <div className="mt-4 flex justify-center space-x-4">
              <FurbridgeButton
                onClick={handleStartOver}
                variant="outline"
                className="border-gray-500 text-gray-500 hover:bg-gray-500 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Record Again
              </FurbridgeButton>
              {!aiContent && (
                <FurbridgeButton
                  onClick={() => processAudioWithAI(audioBlob!)}
                  className="bg-furbridge-orange hover:bg-furbridge-orange/90 text-white"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Process with AI
                </FurbridgeButton>
              )}
            </div>
          </FurbridgeCard>
        )}

        {/* AI Processing Status */}
        {aiProcessing && (
          <FurbridgeCard className="p-6 bg-gradient-to-r from-furbridge-teal/5 to-furbridge-orange/5 border-2 border-furbridge-teal/20">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-furbridge-teal"></div>
                <h3 className="text-lg font-semibold text-gray-900">
                  AI is processing your story...
                </h3>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Processing Progress</span>
                  <span>{Math.round(aiProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-furbridge-teal h-2 rounded-full transition-all duration-300"
                    style={{ width: `${aiProgress}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-white/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">
                  Our AI is working on your story:
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center space-x-2">
                    <Sparkles className="h-3 w-3 text-furbridge-teal" />
                    <span>Transcribing your audio</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Sparkles className="h-3 w-3 text-furbridge-teal" />
                    <span>Generating a meaningful title</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Sparkles className="h-3 w-3 text-furbridge-teal" />
                    <span>Creating a summary</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Sparkles className="h-3 w-3 text-furbridge-teal" />
                    <span>Preparing follow-up questions</span>
                  </li>
                </ul>
              </div>
            </div>
          </FurbridgeCard>
        )}

        {/* AI Generated Content Preview */}
        {aiContent && (
          <FurbridgeCard className="p-6 bg-gradient-to-r from-furbridge-teal/5 to-furbridge-orange/5 border-2 border-furbridge-teal/20">
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-furbridge-teal" />
                <h3 className="text-lg font-semibold text-gray-900">AI Generated Content</h3>
                <Badge className="bg-furbridge-teal text-white text-xs">
                  {Math.round((aiContent.confidence || 0) * 100)}% confidence
                </Badge>
                {aiServiceStatus?.mode === 'mock' && (
                  <Badge variant="outline" className="text-xs border-furbridge-orange text-furbridge-orange">
                    Demo Mode
                  </Badge>
                )}
              </div>

              {aiContent.title && (
                <div className="bg-white/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Sparkles className="h-3 w-3 mr-1 text-furbridge-orange" />
                    Generated Title:
                  </h4>
                  <p className="text-lg font-semibold text-gray-900">{aiContent.title}</p>
                </div>
              )}

              {aiContent.summary && (
                <div className="bg-white/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Sparkles className="h-3 w-3 mr-1 text-furbridge-orange" />
                    Story Summary:
                  </h4>
                  <p className="text-gray-700 leading-relaxed">{aiContent.summary}</p>
                </div>
              )}

              {aiContent.transcript && (
                <div className="bg-white/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Sparkles className="h-3 w-3 mr-1 text-furbridge-orange" />
                    Transcript Preview:
                  </h4>
                  <p className="text-sm text-gray-600 line-clamp-3">{aiContent.transcript}</p>
                </div>
              )}

              {aiContent.followUpQuestions && aiContent.followUpQuestions.length > 0 && (
                <div className="bg-white/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <Sparkles className="h-3 w-3 mr-1 text-furbridge-orange" />
                    Suggested Follow-up Questions:
                  </h4>
                  <div className="space-y-2">
                    {aiContent.followUpQuestions.slice(0, 3).map((question, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <span className="text-furbridge-teal font-medium text-sm mt-0.5">
                          {index + 1}.
                        </span>
                        <p className="text-sm text-gray-700 flex-1">{question}</p>
                      </div>
                    ))}
                  </div>

                  {aiContent.followUpQuestions.length > 3 && (
                    <p className="text-xs text-gray-500 mt-2">
                      +{aiContent.followUpQuestions.length - 3} more questions available
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-center space-x-4 pt-4">
                <FurbridgeButton
                  variant="outline"
                  onClick={handleStartOver}
                  className="border-gray-500 text-gray-500 hover:bg-gray-500 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Start Over
                </FurbridgeButton>
                <FurbridgeButton
                  onClick={handleSubmitStory}
                  disabled={isSubmitting}
                  className="bg-furbridge-teal hover:bg-furbridge-teal/90 text-white px-8"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Save Story
                    </>
                  )}
                </FurbridgeButton>
              </div>

              {/* Submission Error */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <p className="text-red-700 text-sm">{submitError}</p>
                </div>
              )}
            </div>
          </FurbridgeCard>
        )}
      </div>
    </div>
  )
}
