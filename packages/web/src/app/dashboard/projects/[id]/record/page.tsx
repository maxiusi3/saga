'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Mic, MicOff, Play, Pause, Square, RotateCcw, Send, Volume2, Sparkles } from 'lucide-react'
import { StoryPrompt, getNextPrompt, getPromptById, AI_PROMPT_CHAPTERS } from '@saga/shared'

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
  const projectId = params.id as string
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordingProgress, setRecordingProgress] = useState(0)
  
  // AI states
  const [currentPrompt, setCurrentPrompt] = useState<StoryPrompt | null>(null)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [aiProgress, setAiProgress] = useState(0)
  const [aiContent, setAiContent] = useState<AIContent | null>(null)
  
  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const progressRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load initial prompt
  useEffect(() => {
    const prompt = getNextPrompt()
    setCurrentPrompt(prompt)
  }, [])

  // Timer effect
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isRecording, isPaused])

  // Progress bar effect
  useEffect(() => {
    if (isRecording && !isPaused) {
      progressRef.current = setInterval(() => {
        setRecordingProgress(prev => Math.min(prev + 0.5, 100))
      }, 100)
    } else {
      if (progressRef.current) {
        clearInterval(progressRef.current)
      }
    }

    return () => {
      if (progressRef.current) {
        clearInterval(progressRef.current)
      }
    }
  }, [isRecording, isPaused])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)
      setRecordingProgress(0)
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause()
      setIsPaused(true)
    }
  }

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume()
      setIsPaused(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop()
      setIsRecording(false)
      setIsPaused(false)
    }
  }

  const reRecord = () => {
    setAudioBlob(null)
    setRecordingTime(0)
    setRecordingProgress(0)
    setAiContent(null)
    startRecording()
  }

  const playPrompt = () => {
    if (currentPrompt && audioRef.current) {
      // This would play the AI-generated audio prompt
      // For now, we'll use text-to-speech or show a placeholder
      console.log('Playing prompt:', currentPrompt.text)
    }
  }

  const processWithAI = async () => {
    if (!audioBlob) return

    setAiProcessing(true)
    setAiProgress(0)

    // Simulate AI processing with progress updates
    const progressSteps = [
      { progress: 25, message: 'Transcribing audio...' },
      { progress: 50, message: 'Generating title...' },
      { progress: 75, message: 'Creating summary...' },
      { progress: 100, message: 'Preparing follow-up questions...' }
    ]

    for (const step of progressSteps) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      setAiProgress(step.progress)
    }

    // Mock AI-generated content
    const mockAIContent: AIContent = {
      title: "My First Day at Work",
      summary: "A heartwarming story about starting a new job and the nervousness that comes with new beginnings. The storyteller shares their experience of walking into their first workplace and the mix of excitement and anxiety they felt.",
      transcript: "Well, I remember my first day at work like it was yesterday. I was so nervous, my hands were shaking as I walked through those office doors...",
      followUpQuestions: [
        "What was the most surprising thing about your first day?",
        "How did your colleagues welcome you?",
        "What advice would you give to someone starting their first job?"
      ],
      confidence: 0.92
    }

    setAiContent(mockAIContent)
    setAiProcessing(false)
  }

  const submitStory = () => {
    // Navigate to project page with success message
    router.push(`/dashboard/projects/${projectId}?story_added=true`)
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
        <FurbridgeCard className="p-6">
          <div className="space-y-6">
            {/* Timer and Progress */}
            <div className="text-center space-y-4">
              <div className="text-4xl font-mono font-bold text-gray-900">
                {formatTime(recordingTime)}
              </div>
              
              {(isRecording || recordingTime > 0) && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Recording Progress</span>
                    <span>{Math.round(recordingProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-furbridge-teal h-2 rounded-full transition-all duration-300"
                      style={{ width: `${recordingProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Recording Controls */}
            <div className="flex justify-center space-x-4">
              {!isRecording && !audioBlob && (
                <FurbridgeButton
                  onClick={startRecording}
                  className="bg-furbridge-teal hover:bg-furbridge-teal/90 text-white px-8 py-3"
                >
                  <Mic className="h-5 w-5 mr-2" />
                  Start Recording
                </FurbridgeButton>
              )}

              {isRecording && !isPaused && (
                <>
                  <FurbridgeButton
                    variant="outline"
                    onClick={pauseRecording}
                    className="border-furbridge-orange text-furbridge-orange hover:bg-furbridge-orange hover:text-white"
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </FurbridgeButton>
                  <FurbridgeButton
                    variant="outline"
                    onClick={stopRecording}
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </FurbridgeButton>
                </>
              )}

              {isRecording && isPaused && (
                <>
                  <FurbridgeButton
                    onClick={resumeRecording}
                    className="bg-furbridge-teal hover:bg-furbridge-teal/90 text-white"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </FurbridgeButton>
                  <FurbridgeButton
                    variant="outline"
                    onClick={stopRecording}
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </FurbridgeButton>
                </>
              )}

              {audioBlob && !aiProcessing && !aiContent && (
                <>
                  <FurbridgeButton
                    variant="outline"
                    onClick={reRecord}
                    className="border-gray-500 text-gray-500 hover:bg-gray-500 hover:text-white"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Re-record
                  </FurbridgeButton>
                  <FurbridgeButton
                    onClick={processWithAI}
                    className="bg-furbridge-orange hover:bg-furbridge-orange/90 text-white"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Process with AI
                  </FurbridgeButton>
                </>
              )}
            </div>

            {/* Recording Status */}
            {isRecording && (
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-pulse bg-red-500 rounded-full h-3 w-3"></div>
                  <span className="text-sm text-gray-600">
                    {isPaused ? 'Recording paused' : 'Recording in progress...'}
                  </span>
                </div>
              </div>
            )}

            {/* Recording Tips */}
            {!isRecording && !audioBlob && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  📝 Recording Tips:
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Find a quiet space with minimal background noise</li>
                  <li>• Speak clearly and at a comfortable pace</li>
                  <li>• Take your time - you can pause and resume anytime</li>
                  <li>• Don't worry about being perfect - natural is better</li>
                </ul>
              </div>
            )}
          </div>
        </FurbridgeCard>

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
                  onClick={reRecord}
                  className="border-gray-500 text-gray-500 hover:bg-gray-500 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Re-record
                </FurbridgeButton>
                <FurbridgeButton
                  variant="orange"
                  onClick={submitStory}
                  className="px-8"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Add to Project
                </FurbridgeButton>
              </div>
            </div>
          </FurbridgeCard>
        )}
      </div>
    </div>
  )
}
