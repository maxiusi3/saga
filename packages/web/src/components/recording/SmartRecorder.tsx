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
import { agentService } from '@/lib/agent-service'
import { createLocalRecordingSession, type LocalRecordingSession } from '@/lib/local-recording-session'
import { selectRecordingMimeType } from '@/lib/recording-session'
import { useAuthStore } from '@/stores/auth-store'
import type { InterventionLevel } from '@saga/shared/types/agents'
import type { InterviewPhase } from '@/lib/agents/interview-agent'

interface SmartRecorderProps {
  onRecordingComplete: (result: RecordingResult) => void
  onError?: (error: string) => void
  projectId?: string
  storytellerId?: string
  interviewSessionId?: string | null
  interventionLevel?: InterventionLevel
  maxDuration?: number // in seconds, default 1200 (20 minutes)
  className?: string
  promptText?: string
  locale?: string
}

interface RecordingResult {
  audioBlob?: Blob
  transcript: string
  duration: number
  method: 'realtime' | 'traditional'
}

type RecordingState = 'idle' | 'starting' | 'recording' | 'paused' | 'completed' | 'processing'
type RecordingMethod = 'realtime' | 'traditional' | 'auto'

interface Capture {
  recorder: MediaRecorder
  stream: MediaStream
  local: LocalRecordingSession
  chunks: Blob[]
  generation: number
  cancelled: boolean
  failed: boolean
}


export function SmartRecorder({
  onRecordingComplete,
  onError,
  projectId,
  storytellerId,
  interviewSessionId = null,
  interventionLevel = 'low',
  maxDuration = 1200, // 20 minutes
  className = '',
  promptText,
  locale = 'en'
}: SmartRecorderProps) {
  const t = useTranslations('recording')
  const userId = useAuthStore(state => state.user?.id)
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
  const [previousPrompts, setPreviousPrompts] = useState<string[]>([])
  const [lastProcessedLength, setLastProcessedLength] = useState(0)
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeStartedAtRef = useRef<number | null>(null)
  const activeElapsedMsRef = useRef(0)
  const captureRef = useRef<Capture | null>(null)
  const generationRef = useRef(0)
  const startingRef = useRef(false)
  const resumingRef = useRef(false)
  const mountedRef = useRef(true)
  const cancelCaptureRef = useRef<() => void>(() => {})

  // Each captured session owns its queues; overlapping reconnect events share one sync.
  useEffect(() => {
    const syncChunks = () => { void captureRef.current?.local.sync() }
    window.addEventListener('online', syncChunks)
    const interval = setInterval(syncChunks, 30000)
    return () => {
      window.removeEventListener('online', syncChunks)
      clearInterval(interval)
    }
  }, [])

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

  const shouldRequestInterventions = useCallback(() => {
    return Boolean(projectId && storytellerId && interviewSessionId && interventionLevel !== 'off')
  }, [projectId, storytellerId, interviewSessionId, interventionLevel])

  const requestInterviewPrompt = useCallback(async ({
    phase,
    recentTranscript,
    silenceMs,
    transcriptStartOffset = null,
    transcriptEndOffset = null,
  }: {
    phase: InterviewPhase
    recentTranscript: string
    silenceMs: number
    transcriptStartOffset?: number | null
    transcriptEndOffset?: number | null
  }) => {
    if (!projectId || !storytellerId || !interviewSessionId || interventionLevel === 'off') {
      return null
    }

    const generation = generationRef.current
    const response = await agentService.requestInterviewIntervention({
      projectId,
      storytellerId,
      interviewSessionId,
      interventionLevel,
      phase,
      currentPrompt: promptText,
      recentTranscript,
      previousStorySummary: null,
      previousPrompts,
      silenceMs,
      transcriptStartOffset,
      transcriptEndOffset,
    })

    if (generation !== generationRef.current || !mountedRef.current) return null
    const prompt = response.intervention.shouldIntervene
      ? response.intervention.promptText
      : ''

    if (prompt) {
      setAiPrompt(prompt)
      setPreviousPrompts(prev => [...prev.slice(-4), prompt])
      setTimeout(() => {
        if (generation === generationRef.current && mountedRef.current) setAiPrompt('')
      }, 10000)
    }

    return response
  }, [projectId, storytellerId, interviewSessionId, interventionLevel, promptText, previousPrompts])

  const initializeRealTimeRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return null

    const recognition = new SpeechRecognition()
    const recognitionGeneration = generationRef.current
    recognition.continuous = true
    recognition.interimResults = true
    recognition.continuous = true
    recognition.interimResults = true
    // Map locale to SpeechRecognition language code
    const langMap: Record<string, string> = {
      'en': 'en-US',
      'zh': 'zh-CN',
      'zh-CN': 'zh-CN',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'es': 'es-ES',
      'fr': 'fr-FR'
    }
    recognition.lang = langMap[locale] || locale || 'en-US'

    recognition.onresult = (event: any) => {
      if (recognitionGeneration !== generationRef.current || !isRecordingRef.current) return
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
        resetSilenceTimerRef.current?.() // Reset silence timer on final result
      }
      setInterimTranscript(interimTranscript)
      if (interimTranscript) {
        resetSilenceTimerRef.current?.() // Reset silence timer on interim result (user is speaking)
      }
    }

    recognition.onerror = (event: any) => {
      if (recognitionGeneration !== generationRef.current) return
      console.error('Speech recognition error:', event.error)
      if (event.error === 'network') {
        // Transcription can fail without restarting or discarding the microphone capture.
        setRecordingMethod('traditional')
        toast.error('Live transcription is unavailable. Audio recording is continuing.')
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
      if (recognitionRef.current) {
        return
      }

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
    console.log('[SmartRecorder] Silence detected! Checking conditions...')
    if (recordingState !== 'recording' || isGeneratingPrompt || !shouldRequestInterventions()) {
      console.log('[SmartRecorder] Skipping: Not recording or already generating')
      return
    }

    // Only generate prompt if we have some context, or if it's been a while and they haven't said anything
    const fullTranscript = transcript + interimTranscript
    const newContent = fullTranscript.slice(lastProcessedLength)

    console.log('[SmartRecorder] Full length:', fullTranscript.length, 'Last processed:', lastProcessedLength, 'New content length:', newContent.length)

    // Relaxed constraint: even short context is better than nothing, or if empty context but time passed
    // BUT for new prompts, we want at least SOME new content (e.g. > 10 chars) to avoid repeating on same text
    if (newContent.length < 10 && duration < 10) {
      console.log('[SmartRecorder] Skipping: New content too short (< 10 chars)')
      return
    }

    setIsGeneratingPrompt(true)
    try {
      console.log('[SmartRecorder] Requesting interview intervention for NEW context:', newContent.substring(0, 50) + '...')
      const response = await requestInterviewPrompt({
        phase: 'story_listening',
        recentTranscript: newContent,
        silenceMs: 20000,
        transcriptStartOffset: lastProcessedLength,
        transcriptEndOffset: fullTranscript.length,
      })
      console.log('[SmartRecorder] Interview intervention response:', response?.intervention)
      if (response) {
        setLastProcessedLength(fullTranscript.length) // Mark up to here as processed
      }
    } catch (error) {
      console.error('[SmartRecorder] Failed to request interview intervention:', error)
    } finally {
      setIsGeneratingPrompt(false)
    }
  }, [recordingState, transcript, interimTranscript, isGeneratingPrompt, lastProcessedLength, requestInterviewPrompt, shouldRequestInterventions])

  const { resetSilenceTimer } = useSilenceDetection({
    onSilence: handleSilence,
    threshold: 20000, // 20 seconds of silence triggers prompt
    enabled: recordingState === 'recording' && shouldRequestInterventions()
  })

  // Keep a ref to resetSilenceTimer to avoid stale closures in SpeechRecognition callbacks
  const resetSilenceTimerRef = useRef(resetSilenceTimer)
  useEffect(() => {
    resetSilenceTimerRef.current = resetSilenceTimer
  }, [resetSilenceTimer])

  const startTimer = useCallback((reset = false) => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (reset) activeElapsedMsRef.current = 0
    activeStartedAtRef.current = Date.now()

    timerRef.current = setInterval(() => {
      const elapsed = activeElapsedMsRef.current + Date.now() - activeStartedAtRef.current!
      const seconds = Math.floor(elapsed / 1000)
      setDuration(seconds)

      if (seconds >= maxDuration) {
        stopRecording()
        toast.error(`Reached maximum recording duration of ${maxDuration / 60} minutes`)
      }
    }, 1000)
  }, [maxDuration])

  const stopTimer = useCallback(() => {
    if (activeStartedAtRef.current !== null) {
      activeElapsedMsRef.current += Date.now() - activeStartedAtRef.current
      activeStartedAtRef.current = null
      if (mountedRef.current) setDuration(Math.floor(activeElapsedMsRef.current / 1000))
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Wake Lock Implementation
  const wakeLockRef = useRef<any>(null)
  const wakeLockRequestRef = useRef<Promise<void> | null>(null)

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator) || wakeLockRef.current) return
    if (wakeLockRequestRef.current) return wakeLockRequestRef.current

    const generation = generationRef.current
    const request = (async () => {
      try {
        const lock = await (navigator as any).wakeLock.request('screen')
        if (generation !== generationRef.current || !mountedRef.current || wakeLockRef.current) {
          await lock.release()
          return
        }
        wakeLockRef.current = lock
        console.log('Wake Lock is active')

        lock.addEventListener('release', () => {
          if (wakeLockRef.current === lock) wakeLockRef.current = null
          console.log('Wake Lock was released')
        })
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`)
      }
    })()
    wakeLockRequestRef.current = request
    try {
      await request
    } finally {
      if (wakeLockRequestRef.current === request) wakeLockRequestRef.current = null
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    const lock = wakeLockRef.current
    if (lock) {
      if (wakeLockRef.current === lock) {
        wakeLockRef.current = null
      }
      try {
        await lock.release()
        console.log('Wake Lock released manually')
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`)
      }
    }
  }, [])

  // Handle visibility change to re-acquire lock
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && recordingState === 'recording') {
        await requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [recordingState, requestWakeLock])

  const endCapture = useCallback((capture: Capture) => {
    if (capture.recorder.state !== 'inactive') capture.recorder.stop()
    capture.stream.getTracks().forEach(track => track.stop())
  }, [])

  cancelCaptureRef.current = () => {
    generationRef.current += 1
    startingRef.current = false
    resumingRef.current = false
    isRecordingRef.current = false
    const capture = captureRef.current
    if (capture) {
      capture.cancelled = true
      endCapture(capture)
      // Page exit is best effort; onstop also waits for the last dataavailable write.
      void capture.local.interrupt().catch(() => {})
    }
    // Permission may have resolved while the initial IndexedDB write is still pending.
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    stopTimer()
    void releaseWakeLock()
  }

  useEffect(() => {
    mountedRef.current = true
    setRecordingState('idle')
    setTranscript('')
    setInterimTranscript('')
    setAudioBlob(null)
    setAudioUrl(null)
    setAiPrompt('')
    setPreviousPrompts([])
    setLastProcessedLength(0)
    setDuration(0)
    return () => {
      mountedRef.current = false
      cancelCaptureRef.current()
    }
  }, [projectId, userId])

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  useEffect(() => {
    const leave = () => {
      cancelCaptureRef.current()
      setRecordingState('idle')
    }
    window.addEventListener('pagehide', leave)
    return () => window.removeEventListener('pagehide', leave)
  }, [])

  const startRecording = useCallback(async () => {
    if (startingRef.current || captureRef.current?.recorder.state === 'recording' || captureRef.current?.recorder.state === 'paused') return
    startingRef.current = true
    const generation = ++generationRef.current
    const isCurrent = () => mountedRef.current && generationRef.current === generation
    let stream: MediaStream | null = null
    let local: LocalRecordingSession | null = null
    setRecordingState('starting')
    try {
      if (!projectId || !userId) throw new Error('A project and signed-in user are required to record')
      if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        throw new Error('Audio recording is not supported in this browser')
      }
      const requestedMime = selectRecordingMimeType(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'])
      if (!requestedMime) throw new Error('No supported audio recording format is available')
      await requestWakeLock()
      if (!isCurrent()) return
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!isCurrent()) { stream.getTracks().forEach(track => track.stop()); return }
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: requestedMime, audioBitsPerSecond: 64000 })
      const mimeType = recorder.mimeType
      if (!mimeType || !['audio/webm', 'audio/mp4', 'audio/ogg'].includes(mimeType.split(';')[0])) {
        throw new Error('The browser did not provide a supported recording format')
      }
      local = await createLocalRecordingSession({
        id: crypto.randomUUID(), projectId, userId, mimeType, startedAt: new Date().toISOString(),
      })
      if (!isCurrent()) {
        stream.getTracks().forEach(track => track.stop())
        await local.interrupt()
        return
      }
      const capture: Capture = { recorder, stream, local, chunks: [], generation, cancelled: false, failed: false }
      captureRef.current = capture
      mediaRecorderRef.current = recorder
      streamRef.current = stream
      const fail = (error: unknown) => {
        capture.failed = true
        endCapture(capture)
        void capture.local.interrupt().catch(() => {})
        if (!isCurrent() || capture.cancelled) return
        stopTimer()
        isRecordingRef.current = false
        setRecordingState('idle')
        const message = error instanceof Error ? error.message : 'Recording was interrupted'
        onError?.(message)
        toast.error(message)
        void releaseWakeLock()
      }
      recorder.ondataavailable = event => {
        if (!event.data.size) return
        capture.chunks.push(event.data)
        void capture.local.persist(event.data).catch(fail)
      }
      recorder.onerror = () => fail(new Error('Recording was interrupted by the browser'))
      recorder.onstop = async () => {
        try {
          await capture.local.interrupt()
          if (!isCurrent() || capture.cancelled || capture.failed) return
          const completedBlob = new Blob(capture.chunks, { type: mimeType })
          if (!completedBlob.size) throw new Error('The recording contains no audio')
          setAudioBlob(completedBlob)
          setAudioUrl(URL.createObjectURL(completedBlob))
          stopTimer()
          isRecordingRef.current = false
          setRecordingState('completed')
          toast.success(t('success.recorded'))
        } catch (error) {
          if (!capture.failed) fail(error)
        } finally {
          capture.stream.getTracks().forEach(track => track.stop())
          if (isCurrent()) void releaseWakeLock()
        }
      }
      recorder.start(60000)
      setRecordingState('recording')
      isRecordingRef.current = true
      setTranscript('')
      setInterimTranscript('')
      setDuration(0)
      startTimer(true)
      toast.success('Started recording')
      void requestInterviewPrompt({
        phase: 'opening', recentTranscript: '', silenceMs: 0,
        transcriptStartOffset: 0, transcriptEndOffset: 0,
      }).catch(error => console.warn('[SmartRecorder] Failed to request opening intervention:', error))
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop())
      if (local) void local.interrupt().catch(() => {})
      if (!isCurrent()) return
      const message = error instanceof Error ? error.message : 'Failed to start recording'
      setRecordingState('idle')
      onError?.(message)
      toast.error(message)
      void releaseWakeLock()
    } finally {
      if (isCurrent()) startingRef.current = false
    }
  }, [projectId, userId, startTimer, stopTimer, onError, requestWakeLock, releaseWakeLock, requestInterviewPrompt, endCapture, t])

  const pauseRecording = useCallback(() => {
    if (recordingState !== 'recording') return

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
    }

    stopTimer()
    setRecordingState('paused')
    toast.success(t('success.paused'))
    releaseWakeLock() // Release lock when paused
  }, [recordingState, stopTimer, releaseWakeLock])

  const resumeRecording = useCallback(async () => {
    const capture = captureRef.current
    if (recordingState !== 'paused' || !capture || resumingRef.current) return
    const generation = generationRef.current
    resumingRef.current = true

    try {
      await requestWakeLock()
      if (!mountedRef.current || generation !== generationRef.current) return
      if (captureRef.current !== capture || capture.cancelled || capture.failed || capture.recorder.state !== 'paused') {
        void releaseWakeLock()
        return
      }
      capture.recorder.resume()
      startTimer()
      setRecordingState('recording')
      toast.success(t('success.resumed'))
    } finally {
      if (generation === generationRef.current) resumingRef.current = false
    }
  }, [recordingState, startTimer, requestWakeLock, releaseWakeLock, t])

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    const capture = captureRef.current
    if (!capture || capture.recorder.state === 'inactive') return
    setRecordingState('processing')
    stopTimer()
    endCapture(capture)
  }, [stopTimer, endCapture])

  const resetRecording = useCallback(() => {
    cancelCaptureRef.current()
    captureRef.current = null
    mediaRecorderRef.current = null
    streamRef.current = null
    setRecordingState('idle')
    setDuration(0)
    setTranscript('')
    setInterimTranscript('')
    setAudioBlob(null)
    setAiPrompt('')
    setPreviousPrompts([])
    setLastProcessedLength(0)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
  }, [audioUrl])

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

    void requestInterviewPrompt({
      phase: 'closing',
      recentTranscript: result.transcript,
      silenceMs: 0,
      transcriptStartOffset: 0,
      transcriptEndOffset: result.transcript.length,
    }).catch((error) => {
      console.warn('[SmartRecorder] Failed to request closing intervention:', error)
    })
  }, [audioBlob, transcript, duration, shouldUseRealtime, onRecordingComplete, requestInterviewPrompt])

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
                {recordingState === 'starting' && 'Preparing microphone…'}
                {recordingState === 'processing' && 'Saving recording…'}
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
