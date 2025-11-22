'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Mic, Square, Pause, Play, RotateCcw, Wifi, WifiOff, Zap } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { useTranslations } from 'next-intl'
import { useSilenceDetection } from '@/hooks/use-silence-detection'
import { aiService } from '@/lib/ai-service'

interface SmartRecorderProps {
  onRecordingComplete: (result: RecordingResult) => void
  onError?: (error: string) => void
  maxDuration?: number // in seconds, default 1200 (20 minutes)
  className?: string
  promptText?: string
}

interface RecordingResult {
  audioBlob?: Blob
  transcript: string
  duration: number
  method: 'realtime' | 'traditional'
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'completed' | 'processing'
type RecordingMethod = 'realtime' | 'traditional' | 'auto'

export function SmartRecorder({
  onRecordingComplete,
  onError,
  maxDuration = 1200, // 20 minutes
  className = '',
  promptText
}: SmartRecorderProps) {
  const t = useTranslations('recording')
  // States
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordingMethod, setRecordingMethod] = useState<RecordingMethod>('auto')
  const [duration, setDuration] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [networkQuality, setNetworkQuality] = useState<'good' | 'poor' | 'offline'>('good')
  const [isPlaying, setIsPlaying] = useState(false)
  const [aiPrompt, setAiPrompt] = useState<string>('')
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedTimeRef = useRef<number>(0)

  // Check network quality and browser support
  useEffect(() => {
    checkNetworkQuality()
    const interval = setInterval(checkNetworkQuality, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const checkNetworkQuality = useCallback(async () => {
    if (!navigator.onLine) {
      setNetworkQuality('offline')
      return
    }

    try {
      const start = Date.now()
      await fetch('/api/health', { method: 'HEAD', cache: 'no-cache' })
      const latency = Date.now() - start

      setNetworkQuality(latency < 500 ? 'good' : 'poor')
    } catch {
      setNetworkQuality('poor')
    }
  }, [])

  // Enable real-time transcription for AI prompts
  const shouldUseRealtime = useCallback(() => {
    return true
  }, [])

  const initializeRealTimeRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return null

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'zh-CN'

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript)
        resetSilenceTimer() // Reset silence timer on final result
      }
      setInterimTranscript(interimTranscript)
      if (interimTranscript) {
        resetSilenceTimer() // Reset silence timer on interim result (user is speaking)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'network') {
        toast.error('Network connection issue, switching to traditional recording mode')
        setNetworkQuality('offline')
        // Restart with traditional recording
        stopRecording()
        setTimeout(() => {
          setRecordingMethod('traditional')
          startRecording()
        }, 1000)
      }
    }

    recognition.onend = () => {
      // Auto-restart recognition if still recording (to handle timeout)
      if (recordingState === 'recording' && recognitionRef.current) {
        try {
          recognition.start()
        } catch (error) {
          console.warn('Failed to restart recognition:', error)
        }
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'network') {
        // Network error, fallback to traditional recording
        toast.error('Network connection unstable, automatically switching to traditional recording mode')
        setRecordingMethod('traditional')
        stopRecording()
        setTimeout(() => startRecording(), 1000)
      }
    }

    recognition.onend = () => {
      if (recordingState === 'recording') {
        // Restart recognition if still recording
        setTimeout(() => {
          if (recognitionRef.current && recordingState === 'recording') {
            try {
              recognitionRef.current.start()
            } catch (err) {
              console.error('Failed to restart recognition:', err)
            }
          }
        }, 100)
      }
    }

    return recognition
  }, []) // Remove dependency on recordingState to avoid recreation

  // Track recording state in ref for event handlers
  const isRecordingRef = useRef(false)
  useEffect(() => {
    isRecordingRef.current = recordingState === 'recording'
  }, [recordingState])

  useEffect(() => {
    if (recordingState === 'recording') {
      const recognition = initializeRealTimeRecognition()
      if (recognition) {
        recognitionRef.current = recognition
        // Add onend handler here where we have access to the ref
        recognition.onend = () => {
          if (isRecordingRef.current && recognitionRef.current) {
            try {
              console.log('Restarting speech recognition...')
              recognitionRef.current.start()
            } catch (error) {
              console.warn('Failed to restart recognition:', error)
            }
          }
        }

        try {
          recognition.start()
        } catch (error) {
          console.error('Failed to start recognition:', error)
        }
      }
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null // Prevent restart when stopping manually
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [recordingState, initializeRealTimeRecognition])

  // Silence Detection
  const handleSilence = useCallback(async () => {
    if (recordingState !== 'recording' || isGeneratingPrompt) return

    // Only generate prompt if we have some context, or if it's been a while and they haven't said anything
    const currentContext = transcript + interimTranscript
    // Relaxed constraint: even short context is better than nothing, or if empty context but time passed
    if (currentContext.length < 2 && duration < 10) return

    setIsGeneratingPrompt(true)
    try {
      const prompt = await aiService.generateRealtimePrompt(currentContext)
      if (prompt) {
        setAiPrompt(prompt)
        // Auto-clear prompt after 8 seconds
        setTimeout(() => setAiPrompt(''), 8000)
      }
    } catch (error) {
      console.error('Failed to generate prompt:', error)
    } finally {
      setIsGeneratingPrompt(false)
    }
  }, [recordingState, transcript, interimTranscript, isGeneratingPrompt])

  const { resetSilenceTimer } = useSilenceDetection({
    onSilence: handleSilence,
    threshold: 5000, // 5 seconds of silence triggers prompt
    enabled: recordingState === 'recording'
  })

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    pausedTimeRef.current = 0

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current - pausedTimeRef.current
      const seconds = Math.floor(elapsed / 1000)
      setDuration(seconds)

      if (seconds >= maxDuration) {
        stopRecording()
        toast.error(`Reached maximum recording duration of ${maxDuration / 60} minutes`)
      }
    }, 1000)
  }, [maxDuration])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const useRealtime = shouldUseRealtime()

      // Always start MediaRecorder for audio recording
      // 
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000 // 64 kbps: keep ~20min < 10MB for reliable STT upload
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(audioBlob)
        setAudioUrl(URL.createObjectURL(audioBlob))
      }

      mediaRecorder.start()

      if (useRealtime) {
        // Also start real-time speech recognition
        const recognition = initializeRealTimeRecognition()
        if (recognition) {
          recognitionRef.current = recognition
          recognition.start()
          toast.success('Started real-time speech recognition recording (with audio recording)')
        } else {
          throw new Error('Speech recognition unavailable')
        }
      } else {
        toast.success('Started traditional recording')
      }

      setRecordingState('recording')
      setTranscript('')
      setInterimTranscript('')
      setDuration(0)
      startTimer()

    } catch (error) {
      console.error('Failed to start recording:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording'
      onError?.(errorMessage)
      toast.error(errorMessage)
    }
  }, [shouldUseRealtime, initializeRealTimeRecognition, startTimer, onError])

  const pauseRecording = useCallback(() => {
    if (recordingState !== 'recording') return

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
    }

    pausedTimeRef.current += Date.now() - startTimeRef.current
    stopTimer()
    setRecordingState('paused')
    toast.success(t('success.paused'))
  }, [recordingState, stopTimer])

  const resumeRecording = useCallback(() => {
    if (recordingState !== 'paused') return

    if (recognitionRef.current) {
      recognitionRef.current.start()
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
    }

    startTimeRef.current = Date.now()
    startTimer()
    setRecordingState('recording')
    toast.success(t('success.resumed'))
  }, [recordingState, startTimer])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    stopTimer()
    setRecordingState('completed')
    toast.success(t('success.recorded'))
  }, [stopTimer])

  const resetRecording = useCallback(() => {
    stopRecording()
    setRecordingState('idle')
    setDuration(0)
    setTranscript('')
    setInterimTranscript('')
    setAudioBlob(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
  }, [stopRecording, audioUrl])

  const handleComplete = useCallback(() => {
    const result: RecordingResult = {
      audioBlob: audioBlob || undefined,
      transcript: transcript.trim(),
      duration,
      method: shouldUseRealtime() ? 'realtime' : 'traditional'
    }

    if (!result.transcript && !result.audioBlob) {
      toast.error(t('errors.empty'))
      return
    }

    onRecordingComplete(result)
  }, [audioBlob, transcript, duration, shouldUseRealtime, onRecordingComplete])

  const playAudio = useCallback(() => {
    if (!audioUrl) return

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.onplay = () => setIsPlaying(true)
    audio.onpause = () => setIsPlaying(false)
    audio.onended = () => setIsPlaying(false)

    audio.play()
  }, [audioUrl])

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getNetworkIcon = () => {
    switch (networkQuality) {
      case 'good': return <Wifi className="h-4 w-4 text-green-500" />
      case 'poor': return <Wifi className="h-4 w-4 text-yellow-500" />
      case 'offline': return <WifiOff className="h-4 w-4 text-red-500" />
    }
  }

  // Removed method badge since we only use traditional recording now

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground">{t('title')}</h3>
          </div>
          <div className="flex items-center gap-2">
            {getNetworkIcon()}
            <span className="text-sm text-muted-foreground">
              {networkQuality === 'good' ? t('networkStatus.good') :
                networkQuality === 'poor' ? t('networkStatus.poor') : t('networkStatus.offline')}
            </span>
          </div>
        </div>

        {/* Dynamic Prompt Display */}
        <div className="relative min-h-[100px]">
          {aiPrompt ? (
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 rounded-full shrink-0">
                  <Zap className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-indigo-900 mb-1">
                    {t('aiHelper.suggestion')}
                  </p>
                  <p className="text-indigo-700 text-lg font-medium">
                    "{aiPrompt}"
                  </p>
                </div>
              </div>
            </div>
          ) : (
            promptText && (
              <div className="p-4 bg-muted/50 rounded-lg transition-all duration-300 ease-in-out animate-in fade-in">
                <p className="text-sm text-muted-foreground mb-1">{t('prompt')}:</p>
                <p className="text-foreground">{promptText}</p>
              </div>
            )
          )}
        </div>

        {/* Recording Status - Hide when completed */}
        {recordingState !== 'completed' && (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              {recordingState === 'recording' && (
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              )}
              {recordingState === 'paused' && (
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
              )}
              <span className="text-lg font-semibold">
                {recordingState === 'idle' && t('status.ready')}
                {recordingState === 'recording' && t('status.recording')}
                {recordingState === 'paused' && t('status.paused')}
              </span>
            </div>

            {/* Duration */}
            <div className="text-2xl font-mono text-foreground">
              {formatTime(duration)}
            </div>

            {/* Progress Bar */}
            <Progress
              value={(duration / maxDuration) * 100}
              className="w-full max-w-md mx-auto"
            />
          </div>
        )}

        {/* Real-time Transcript & AI Prompts */}
        {shouldUseRealtime() && (
          <div className="space-y-4">
            {/* AI Prompt Overlay removed from here as it is moved to top */}

            {(transcript || interimTranscript) && (
              <div className="p-4 bg-muted/30 rounded-lg min-h-[100px]">
                <p className="text-sm text-muted-foreground mb-2">Real-time Transcription:</p>
                <div className="text-foreground">
                  {transcript}
                  <span className="text-muted-foreground italic">{interimTranscript}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {recordingState === 'idle' && (
            <Button
              onClick={startRecording}
              size="lg"
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <Mic className="h-5 w-5 mr-2" />
              {t('actions.start')}
            </Button>
          )}

          {recordingState === 'recording' && (
            <>
              <Button
                onClick={pauseRecording}
                variant="outline"
                size="lg"
              >
                <Pause className="h-5 w-5 mr-2" />
                {t('actions.pause')}
              </Button>
              <Button
                onClick={stopRecording}
                variant="outline"
                size="lg"
              >
                <Square className="h-5 w-5 mr-2" />
                {t('actions.stop')}
              </Button>
            </>
          )}

          {recordingState === 'paused' && (
            <>
              <Button
                onClick={resumeRecording}
                size="lg"
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <Play className="h-5 w-5 mr-2" />
                {t('actions.continue')}
              </Button>
              <Button
                onClick={stopRecording}
                variant="outline"
                size="lg"
              >
                <Square className="h-5 w-5 mr-2" />
                {t('actions.stop')}
              </Button>
            </>
          )}

          {recordingState === 'completed' && (
            <div className="w-full space-y-4">
              {/* Audio Player Section - Top */}
              {audioUrl && (
                <div className="w-full">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('audio.listenTo')}</h4>
                  <AudioPlayer
                    src={audioUrl}
                    title={t('audio.yourRecording')}
                    className="w-full"
                  />
                </div>
              )}

              {/* Action Buttons - Bottom */}
              <div className="flex justify-center gap-3">
                <Button
                  onClick={handleComplete}
                  size="lg"
                  className="bg-primary hover:bg-primary/90"
                >
                  {t('actions.complete')}
                </Button>
                <Button
                  onClick={resetRecording}
                  variant="outline"
                  size="lg"
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  {t('actions.reRecord')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="text-center text-sm text-muted-foreground">
          {shouldUseRealtime() ? (
            <p>{t('tips.realtime')}</p>
          ) : (
            <p>{t('tips.traditional')}</p>
          )}
        </div>
      </div>
    </Card>
  )
}
