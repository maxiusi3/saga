'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Mic, Square, Pause, Play, RotateCcw, Wifi, WifiOff, Zap } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { AudioPlayer } from '@/components/audio/AudioPlayer'

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

  // 已禁用实时转录（Web Speech API），统一使用传统录音 + 事后转写
  const shouldUseRealtime = useCallback(() => {
    return false
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
      }
      setInterimTranscript(interimTranscript)
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
  }, [recordingState])

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
    toast.success('Recording paused')
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
    toast.success('Recording resumed')
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
    toast.success('Recording completed')
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
      toast.error('录音内容为空，请重新录音')
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

  const getMethodBadge = () => {
    const useRealtime = shouldUseRealtime()
    return (
      <Badge variant={useRealtime ? "default" : "secondary"} className="flex items-center gap-1">
        {useRealtime ? <Zap className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
        {useRealtime ? '实时转录' : '传统录音'}
      </Badge>
    )
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground">智能录音</h3>
            {getMethodBadge()}
          </div>
          <div className="flex items-center gap-2">
            {getNetworkIcon()}
            <span className="text-sm text-muted-foreground">
              {networkQuality === 'good' ? '网络良好' : 
               networkQuality === 'poor' ? '网络较慢' : '离线模式'}
            </span>
          </div>
        </div>

        {/* Prompt Display */}
        {promptText && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">录音提示：</p>
            <p className="text-foreground">{promptText}</p>
          </div>
        )}

        {/* Recording Status */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            {recordingState === 'recording' && (
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            )}
            {recordingState === 'paused' && (
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
            )}
            {recordingState === 'completed' && (
              <div className="w-3 h-3 rounded-full bg-green-500" />
            )}
            <span className="text-lg font-semibold">
              {recordingState === 'idle' && 'Ready to Record'}
              {recordingState === 'recording' && 'Recording...'}
              {recordingState === 'paused' && 'Recording Paused'}
              {recordingState === 'completed' && 'Recording Completed'}
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

        {/* Real-time Transcript */}
        {shouldUseRealtime() && (transcript || interimTranscript) && (
          <div className="p-4 bg-muted/30 rounded-lg min-h-[100px]">
            <p className="text-sm text-muted-foreground mb-2">实时转录：</p>
            <div className="text-foreground">
              {transcript}
              <span className="text-muted-foreground italic">{interimTranscript}</span>
            </div>
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
              开始录音
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
                暂停
              </Button>
              <Button
                onClick={stopRecording}
                variant="outline"
                size="lg"
              >
                <Square className="h-5 w-5 mr-2" />
                Stop
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
                Continue
              </Button>
              <Button
                onClick={stopRecording}
                variant="outline"
                size="lg"
              >
                <Square className="h-5 w-5 mr-2" />
                Stop
              </Button>
            </>
          )}

          {recordingState === 'completed' && (
            <>
              {/* Show AudioPlayer for both recording modes when audio is available */}
              {audioUrl && (
                <div className="w-full mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Listen to recording:</h4>
                  <AudioPlayer
                    src={audioUrl}
                    title="Your Story Recording"
                    className="w-full"
                  />
                </div>
              )}



              <Button
                onClick={handleComplete}
                size="lg"
                className="bg-primary hover:bg-primary/90"
              >
                完成录音
              </Button>
              <Button
                onClick={resetRecording}
                variant="outline"
                size="lg"
              >
                <RotateCcw className="h-5 w-5 mr-2" />
                重新录音
              </Button>
            </>
          )}
        </div>

        {/* Tips */}
        <div className="text-center text-sm text-muted-foreground">
          {shouldUseRealtime() ? (
            <p>💡 正在使用实时语音识别，边说边转录文字</p>
          ) : (
            <p>💡 正在使用传统录音模式，录音完成后将进行转录</p>
          )}
        </div>
      </div>
    </Card>
  )
}
