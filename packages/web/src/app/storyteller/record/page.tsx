'use client'

import { useState, useEffect, useRef } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Mic, MicOff, Square, Play, Pause, RotateCcw, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface RecordingPrompt {
  id: string
  text: string
  category: string
  estimated_time: number
  follow_up_questions?: string[]
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'completed'

export default function RecordPage() {
  const [currentPrompt, setCurrentPrompt] = useState<RecordingPrompt | null>(null)
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Load current prompt - mock data
    const mockPrompt: RecordingPrompt = {
      id: '1',
      text: 'Tell me about your first job. What was it like walking in on your first day?',
      category: 'Career',
      estimated_time: 5,
      follow_up_questions: [
        'What were your colleagues like?',
        'What was the most challenging part?',
        'What did you learn from that experience?'
      ]
    }

    setTimeout(() => {
      setCurrentPrompt(mockPrompt)
      setLoading(false)
    }, 500)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        setAudioBlob(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setRecordingState('recording')
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Unable to access microphone. Please check your permissions.')
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause()
      setRecordingState('paused')
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume()
      setRecordingState('recording')
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setRecordingState('completed')
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }

  const resetRecording = () => {
    setRecordingState('idle')
    setRecordingTime(0)
    setAudioBlob(null)
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
  }

  const submitRecording = async () => {
    if (!audioBlob || !currentPrompt) return

    setIsSubmitting(true)
    
    try {
      // TODO: Upload audio to Supabase Storage and create story record
      // const formData = new FormData()
      // formData.append('audio', audioBlob, 'recording.wav')
      // formData.append('prompt_id', currentPrompt.id)
      
      // Simulate upload
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      router.push('/storyteller/success')
    } catch (error) {
      console.error('Error submitting recording:', error)
      alert('Failed to submit recording. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-furbridge-orange"></div>
      </div>
    )
  }

  if (!currentPrompt) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900">No prompt available</h1>
        <p className="text-gray-600 mt-2">Please check back later.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Prompt Card */}
      <FurbridgeCard className="p-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline">{currentPrompt.category}</Badge>
            <span className="text-sm text-gray-600">
              ~{currentPrompt.estimated_time} min
            </span>
          </div>
          
          <h1 className="text-2xl font-semibold text-gray-900">
            {currentPrompt.text}
          </h1>

          {currentPrompt.follow_up_questions && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-600">
                Consider these follow-up questions:
              </h3>
              <ul className="space-y-1">
                {currentPrompt.follow_up_questions.map((question, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    • {question}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </FurbridgeCard>

      {/* Recording Interface */}
      <FurbridgeCard className="p-8">
        <div className="space-y-6">
          {/* Recording Status */}
          <div className="text-center space-y-2">
            <div className="text-3xl font-mono text-gray-900">
              {formatTime(recordingTime)}
            </div>
            <div className="text-sm text-gray-600">
              {recordingState === 'idle' && 'Ready to record'}
              {recordingState === 'recording' && 'Recording...'}
              {recordingState === 'paused' && 'Recording paused'}
              {recordingState === 'completed' && 'Recording completed'}
            </div>
          </div>

          {/* Progress Bar (estimated time) */}
          {recordingState !== 'idle' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Progress</span>
                <span>{Math.min(100, Math.round((recordingTime / (currentPrompt.estimated_time * 60)) * 100))}%</span>
              </div>
              <Progress 
                value={Math.min(100, (recordingTime / (currentPrompt.estimated_time * 60)) * 100)} 
                className="h-2"
              />
            </div>
          )}

          {/* Recording Controls */}
          <div className="flex justify-center space-x-4">
            {recordingState === 'idle' && (
              <FurbridgeButton
                variant="orange"
                size="lg"
                onClick={startRecording}
                className="px-8"
              >
                <Mic className="h-5 w-5 mr-2" />
                Start Recording
              </FurbridgeButton>
            )}

            {recordingState === 'recording' && (
              <>
                <FurbridgeButton
                  variant="outline"
                  size="lg"
                  onClick={pauseRecording}
                >
                  <Pause className="h-5 w-5 mr-2" />
                  Pause
                </FurbridgeButton>
                <FurbridgeButton
                  variant="teal"
                  size="lg"
                  onClick={stopRecording}
                >
                  <Square className="h-5 w-5 mr-2" />
                  Stop
                </FurbridgeButton>
              </>
            )}

            {recordingState === 'paused' && (
              <>
                <FurbridgeButton
                  variant="orange"
                  size="lg"
                  onClick={resumeRecording}
                >
                  <Play className="h-5 w-5 mr-2" />
                  Resume
                </FurbridgeButton>
                <FurbridgeButton
                  variant="teal"
                  size="lg"
                  onClick={stopRecording}
                >
                  <Square className="h-5 w-5 mr-2" />
                  Stop
                </FurbridgeButton>
              </>
            )}

            {recordingState === 'completed' && (
              <>
                <FurbridgeButton
                  variant="outline"
                  size="lg"
                  onClick={resetRecording}
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Re-record
                </FurbridgeButton>
                <FurbridgeButton
                  variant="orange"
                  size="lg"
                  onClick={submitRecording}
                  disabled={isSubmitting}
                >
                  <Send className="h-5 w-5 mr-2" />
                  {isSubmitting ? 'Submitting...' : 'Submit Story'}
                </FurbridgeButton>
              </>
            )}
          </div>

          {/* Recording Tips */}
          {recordingState === 'idle' && (
            <div className="bg-gray-100/50 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-900">Recording Tips:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Find a quiet space with minimal background noise</li>
                <li>• Speak clearly and at a comfortable pace</li>
                <li>• Take your time - there's no rush</li>
                <li>• You can pause and resume anytime</li>
              </ul>
            </div>
          )}
        </div>
      </FurbridgeCard>
    </div>
  )
}
