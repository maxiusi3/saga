import { useState, useRef, useCallback, useEffect } from 'react'

export interface AudioRecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
  audioUrl: string | null
  error: string | null
  isSupported: boolean
}

export interface AudioRecordingControls {
  startRecording: () => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  resetRecording: () => void
}

const MAX_RECORDING_DURATION = 20 * 60 * 1000 // 20 minutes in milliseconds

export function useAudioRecording(): AudioRecordingState & AudioRecordingControls {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const pausedTimeRef = useRef<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check if audio recording is supported
  useEffect(() => {
    const checkSupport = () => {
      const isMediaRecorderSupported = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported
      const isGetUserMediaSupported = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      setIsSupported(isMediaRecorderSupported && isGetUserMediaSupported)
    }

    checkSupport()
  }, [])

  // Update duration timer
  const updateDuration = useCallback(() => {
    if (isRecording && !isPaused) {
      const now = Date.now()
      const elapsed = now - startTimeRef.current - pausedTimeRef.current
      setDuration(elapsed)

      // Auto-stop at max duration
      if (elapsed >= MAX_RECORDING_DURATION) {
        stopRecording()
      }
    }
  }, [isRecording, isPaused])

  // Start duration timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      intervalRef.current = setInterval(updateDuration, 100)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRecording, isPaused, updateDuration])

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser')
      return
    }

    try {
      setError(null)
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        }
      })

      streamRef.current = stream

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128 kbps for good quality
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        setError('Recording failed. Please try again.')
      }

      // Start recording
      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      setIsPaused(false)
      startTimeRef.current = Date.now()
      pausedTimeRef.current = 0
      setDuration(0)

    } catch (err) {
      console.error('Error starting recording:', err)
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow microphone access and try again.')
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.')
        } else {
          setError('Failed to start recording. Please check your microphone and try again.')
        }
      } else {
        setError('An unexpected error occurred while starting recording.')
      }
    }
  }, [isSupported])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
    }
  }, [isRecording])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      pausedTimeRef.current += Date.now() - startTimeRef.current
    }
  }, [isRecording, isPaused])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      startTimeRef.current = Date.now()
    }
  }, [isRecording, isPaused])

  const resetRecording = useCallback(() => {
    // Stop recording if active
    if (isRecording) {
      stopRecording()
    }

    // Clean up previous recording
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }

    // Reset state
    setIsRecording(false)
    setIsPaused(false)
    setDuration(0)
    setAudioBlob(null)
    setAudioUrl(null)
    setError(null)
    chunksRef.current = []
    startTimeRef.current = 0
    pausedTimeRef.current = 0

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [isRecording, audioUrl, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [audioUrl])

  return {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    error,
    isSupported,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  }
}
