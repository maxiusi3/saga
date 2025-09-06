'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RecordingQualityIndicator } from './RecordingQualityIndicator'
import { saveDraft, clearDraft } from './RecordingDraftRecovery'

interface WebAudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void
  onError: (error: string) => void
  maxDuration?: number // in seconds, default 600 (10 minutes)
  className?: string
  projectId?: string
  promptId?: string
  promptText?: string
  enableDraftSaving?: boolean
}

type RecordingState = 'idle' | 'requesting-permission' | 'recording' | 'paused' | 'completed'

export function WebAudioRecorder({ 
  onRecordingComplete, 
  onError, 
  maxDuration = 600,
  className = '',
  projectId,
  promptId,
  promptText,
  enableDraftSaving = true
}: WebAudioRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [browserSupported, setBrowserSupported] = useState(true)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Check browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setBrowserSupported(false)
      onError('Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Safari.')
    }

    return () => {
      cleanup()
    }
  }, [])

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
  }

  const startRecording = async () => {
    try {
      setRecordingState('requesting-permission')
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      })
      
      streamRef.current = stream
      audioChunksRef.current = []

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })
      
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType 
        })
        setAudioBlob(blob)
        
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        
        setRecordingState('completed')
        onRecordingComplete(blob, duration)
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        onError('Recording failed. Please try again.')
        setRecordingState('idle')
      }

      // Start recording
      mediaRecorder.start(1000) // Collect data every second
      setRecordingState('recording')
      setDuration(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1
          if (newDuration >= maxDuration) {
            stopRecording()
          }
          return newDuration
        })
      }, 1000)

    } catch (error: any) {
      console.error('Failed to start recording:', error)
      
      if (error.name === 'NotAllowedError') {
        onError('Microphone permission denied. Please allow microphone access and try again.')
      } else if (error.name === 'NotFoundError') {
        onError('No microphone found. Please connect a microphone and try again.')
      } else {
        onError('Failed to start recording. Please check your microphone and try again.')
      }
      
      setRecordingState('idle')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop()
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause()
      setRecordingState('paused')
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume()
      setRecordingState('recording')
      
      // Resume timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1
          if (newDuration >= maxDuration) {
            stopRecording()
          }
          return newDuration
        })
      }, 1000)
    }
  }

  const playRecording = () => {
    if (audioUrl && !isPlaying) {
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      
      audio.onended = () => {
        setIsPlaying(false)
        audioRef.current = null
      }
      
      audio.onerror = () => {
        setIsPlaying(false)
        audioRef.current = null
        onError('Failed to play recording')
      }
      
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false)
          onError('Failed to play recording')
        })
    }
  }

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      audioRef.current = null
    }
  }

  const resetRecording = () => {
    cleanup()
    setRecordingState('idle')
    setDuration(0)
    setAudioBlob(null)
    setAudioUrl(null)
    setIsPlaying(false)
    
    // Clear any saved draft
    if (enableDraftSaving && projectId && promptId) {
      clearDraft(projectId, promptId)
    }
  }

  const saveDraftRecording = () => {
    if (enableDraftSaving && projectId && promptId && audioBlob && duration > 0) {
      const saved = saveDraft(projectId, promptId, audioBlob, duration, promptText)
      if (saved) {
        // Show success message or handle as needed
        console.log('Draft saved successfully')
      }
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getRecordingStateText = () => {
    switch (recordingState) {
      case 'requesting-permission':
        return 'Requesting microphone permission...'
      case 'recording':
        return 'Recording in progress...'
      case 'paused':
        return 'Recording paused'
      case 'completed':
        return 'Recording completed'
      default:
        return 'Ready to record'
    }
  }

  if (!browserSupported) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center">
          <div className="text-destructive text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">Browser Not Supported</h3>
          <p className="text-muted-foreground mb-4">
            Your browser doesn't support audio recording. Please use a modern browser like:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Google Chrome (recommended)</li>
            <li>• Mozilla Firefox</li>
            <li>• Safari (on Mac/iOS)</li>
            <li>• Microsoft Edge</li>
          </ul>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-6 ${className}`} role="region" aria-labelledby="recorder-heading">
      <div className="text-center space-y-6">
        {/* Status Display */}
        <div>
          <h3 id="recorder-heading" className="text-xl font-semibold mb-2">{getRecordingStateText()}</h3>
          <div
            className="text-2xl font-mono font-bold text-primary"
            aria-live="polite"
            aria-label={`Recording duration: ${formatDuration(duration)}`}
          >
            {formatDuration(duration)}
          </div>
          {maxDuration > 0 && (
            <div className="text-sm text-muted-foreground mt-1">
              Maximum: {formatDuration(maxDuration)}
            </div>
          )}
        </div>

        {/* Visual Indicator */}
        <div className="flex justify-center">
          {recordingState === 'recording' && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-destructive rounded-full animate-pulse"></div>
              <span className="text-destructive font-medium">RECORDING</span>
            </div>
          )}
          {recordingState === 'paused' && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-warning rounded-full"></div>
              <span className="text-warning font-medium">PAUSED</span>
            </div>
          )}
          {recordingState === 'completed' && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-success rounded-full"></div>
              <span className="text-success font-medium">COMPLETED</span>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap justify-center gap-3" role="group" aria-label="Recording controls">
          {recordingState === 'idle' && (
            <Button
              onClick={startRecording}
              size="lg"
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-8 py-4 text-lg font-bold touch-target-large"
              aria-label="Start recording your story"
            >
              <span aria-hidden="true">🎤 </span>Start Recording
            </Button>
          )}

          {recordingState === 'recording' && (
            <>
              <Button
                onClick={pauseRecording}
                size="lg"
                variant="outline"
                className="px-6 py-3 touch-target"
                aria-label="Pause recording"
              >
                <span aria-hidden="true">⏸️ </span>Pause
              </Button>
              <Button
                onClick={stopRecording}
                size="lg"
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-6 py-3 touch-target"
                aria-label="Stop recording"
              >
                <span aria-hidden="true">⏹️ </span>Stop
              </Button>
            </>
          )}

          {recordingState === 'paused' && (
            <>
              <Button
                onClick={resumeRecording}
                size="lg"
                className="bg-success hover:bg-success/90 text-success-foreground px-6 py-3"
              >
                ▶️ Resume
              </Button>
              <Button
                onClick={stopRecording}
                size="lg"
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-6 py-3"
              >
                ⏹️ Stop
              </Button>
            </>
          )}

          {recordingState === 'completed' && (
            <>
              <Button
                onClick={isPlaying ? stopPlayback : playRecording}
                size="lg"
                variant="outline"
                className="px-6 py-3 touch-target"
                disabled={!audioUrl}
                aria-label={isPlaying ? "Stop playback" : "Play recording to review"}
              >
                <span aria-hidden="true">{isPlaying ? '⏹️ ' : '▶️ '}</span>
                {isPlaying ? 'Stop' : 'Play'}
              </Button>
              <Button
                onClick={resetRecording}
                size="lg"
                variant="outline"
                className="px-6 py-3 touch-target"
                aria-label="Delete current recording and record again"
              >
                <span aria-hidden="true">🔄 </span>Record Again
              </Button>
              {enableDraftSaving && projectId && promptId && (
                <Button
                  onClick={saveDraftRecording}
                  size="sm"
                  variant="outline"
                  className="px-4 py-2 text-sm touch-target"
                  aria-label="Save recording as draft for later"
                >
                  <span aria-hidden="true">💾 </span>Save Draft
                </Button>
              )}
            </>
          )}
        </div>

        {/* Recording Quality Indicator */}
        {recordingState === 'recording' && (
          <div className="space-y-4">
            <RecordingQualityIndicator 
              stream={streamRef.current}
              isRecording={recordingState === 'recording'}
            />
            <div className="text-sm text-muted-foreground">
              <p>💡 Tip: Watch the quality indicator above for the best recording</p>
            </div>
          </div>
        )}

        {/* Completion Message */}
        {recordingState === 'completed' && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-4" role="status" aria-live="polite">
            <p className="text-success-foreground font-medium">
              <span aria-hidden="true">✅ </span>Recording completed! You can play it back to review, or record again if needed.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}