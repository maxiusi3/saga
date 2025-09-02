'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Mic, MicOff, Square, Play, Pause, RotateCcw, Send, Volume2, Sparkles, Clock, ArrowLeft } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AIPrompt, getNextPrompt, getPromptById } from '../../../shared/src/lib/ai-prompts'
import { AIService, AIGeneratedContent } from '../../../shared/src/lib/ai-services'

type RecordingState = 'idle' | 'recording' | 'paused' | 'completed'

function RecordPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [currentPrompt, setCurrentPrompt] = useState<AIPrompt | null>(null)
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [aiProgress, setAiProgress] = useState(0)
  const [aiContent, setAiContent] = useState<AIGeneratedContent | null>(null)
  const [isPlayingPrompt, setIsPlayingPrompt] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const promptAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const loadPrompt = async () => {
      try {
        // Check if there's a specific prompt ID or custom prompt from URL params
        const promptId = searchParams?.get('promptId')
        const customPrompt = searchParams?.get('prompt')
        const promptType = searchParams?.get('type')

        let prompt: AIPrompt | null = null

        if (customPrompt) {
          // Handle custom follow-up questions
          prompt = {
            id: 'custom-followup',
            chapter: 'Follow-up',
            chapterNumber: 0,
            category: promptType === 'followup' ? 'Follow-up Question' : 'Custom',
            text: decodeURIComponent(customPrompt),
            estimatedTime: 5
          }
        } else if (promptId) {
          // Load specific prompt by ID
          prompt = getPromptById(promptId)
        } else {
          // Get next prompt in sequence (for now, just get the first one)
          prompt = getNextPrompt()
        }

        if (prompt) {
          setCurrentPrompt(prompt)
        }
      } catch (error) {
        console.error('Failed to load prompt:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPrompt()

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [searchParams])

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
      console.error('Error starting recording:', error);
      alert('Unable to access microphone. Please check your permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingState('completed');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resetRecording = () => {
    setRecordingState('idle');
    setRecordingTime(0);
    setAudioBlob(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const submitRecording = async () => {
    if (!audioBlob || !currentPrompt) return;

    setIsSubmitting(true);
    setAiProcessing(true);
    setAiProgress(0);

    try {
      // Process audio with AI services
      const aiResult = await AIService.processStoryAudio(
        audioBlob,
        currentPrompt.text,
        (step: string, progress: number) => {
          setAiProgress(progress);
        }
      );

      setAiContent(aiResult);

      // TODO: Upload audio to Supabase Storage and create story record with AI content
      // const formData = new FormData()
      // formData.append('audio', audioBlob, 'recording.wav')
      // formData.append('prompt_id', currentPrompt.id)
      // formData.append('ai_title', aiResult.title || '')
      // formData.append('ai_transcript', aiResult.transcript || '')
      // formData.append('ai_summary', aiResult.summary || '')
      // formData.append('ai_follow_up_questions', JSON.stringify(aiResult.followUpQuestions || []))

      // Simulate final upload
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Navigate to review page with AI content
      router.push('/storyteller/review?processed=true');
    } catch (error) {
      console.error('Error submitting recording:', error);
      alert('Failed to submit recording. Please try again.');
    } finally {
      setIsSubmitting(false);
      setAiProcessing(false);
    }
  };

  const handlePlayPrompt = () => {
    // Mock audio playback - in real implementation, this would play a TTS version of the prompt
    setIsPlayingPrompt(true);

    // Simulate audio duration
    setTimeout(() => {
      setIsPlayingPrompt(false);
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-furbridge-orange"></div>
      </div>
    );
  }

  if (!currentPrompt) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900">No prompt available</h1>
        <p className="text-gray-600 mt-2">Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          href="/storyteller"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Stories
        </Link>

        {/* AI Prompt Section */}
        <FurbridgeCard className="p-8 bg-gradient-to-r from-furbridge-orange/5 to-furbridge-teal/5 border-2 border-furbridge-orange/20">
          <div className="space-y-6">
            {/* Chapter & Category */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Badge className="bg-furbridge-orange text-white">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {currentPrompt.chapter}
                </Badge>
                <Badge variant="outline">{currentPrompt.category}</Badge>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span className="text-sm">~{currentPrompt.estimatedTime} min</span>
              </div>
            </div>

            {/* Prompt Text */}
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold text-gray-900 leading-relaxed">
                {currentPrompt.text}
              </h1>

              {/* Hear Prompt Button */}
              <FurbridgeButton
                variant="outline"
                size="sm"
                onClick={handlePlayPrompt}
                disabled={isPlayingPrompt}
                className="flex items-center space-x-2"
              >
                <Volume2 className="h-4 w-4" />
                <span>{isPlayingPrompt ? 'Playing...' : 'Hear Prompt'}</span>
              </FurbridgeButton>
            </div>

            {/* Follow-up Suggestions */}
            {currentPrompt.followUpSuggestions && currentPrompt.followUpSuggestions.length > 0 && (
              <div className="space-y-3 bg-white/50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                  <Sparkles className="h-4 w-4 mr-2 text-furbridge-teal" />
                  Consider exploring these aspects:
                </h3>
                <ul className="space-y-2">
                  {currentPrompt.followUpSuggestions.map((question, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start">
                      <span className="text-furbridge-orange mr-2 mt-1">•</span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </FurbridgeCard>

        {/* AI Processing Status */}
        {aiProcessing && (
          <FurbridgeCard className="p-6 bg-furbridge-teal/5 border-furbridge-teal/20">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Sparkles className="h-5 w-5 text-furbridge-teal animate-pulse" />
                <h3 className="font-semibold text-gray-900">AI Processing Your Story</h3>
              </div>

              <div className="space-y-2">
                <Progress value={aiProgress} className="h-3" />
                <div className="text-sm text-gray-600 text-center">
                  {aiProgress < 40 ? 'Transcribing your story...' :
                   aiProgress < 70 ? 'Generating title suggestions...' :
                   aiProgress < 90 ? 'Creating follow-up questions...' :
                   'Almost done!'}
                </div>
              </div>
            </div>
          </FurbridgeCard>
        )}

        {/* Recording Interface */}
        <FurbridgeCard className="p-8">
          <div className="space-y-6">
            {/* Recording Status */}
            <div className="text-center space-y-2">
              <div className="text-4xl font-mono text-gray-900">
                {formatTime(recordingTime)}
              </div>
              <div className="text-sm text-gray-600">
                {recordingState === 'idle' && 'Ready to record your story'}
                {recordingState === 'recording' && (
                  <span className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Recording...</span>
                  </span>
                )}
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
                  disabled={isSubmitting || aiProcessing}
                  className="min-w-48"
                >
                  {aiProcessing ? (
                    <>
                      <Sparkles className="h-5 w-5 mr-2 animate-pulse" />
                      Processing with AI...
                    </>
                  ) : isSubmitting ? (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Submit Story
                    </>
                  )}
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
  );
}

export default function RecordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-furbridge-orange"></div>
      </div>
    }>
      <RecordPageContent />
    </Suspense>
  )
}
