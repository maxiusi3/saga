'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Send,
  Trash2,
  Camera,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  Volume2
} from 'lucide-react'

interface RecordingInterfaceProps {
  onRecordingComplete?: (audioBlob: Blob, duration: number) => void
  onUploadComplete?: (audioUrl: string, photoUrl?: string) => void
  maxDuration?: number // in seconds, default 600 (10 minutes)
  projectId: string
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'reviewing' | 'uploading' | 'complete' | 'error'

export function RecordingInterface({
  onRecordingComplete,
  onUploadComplete,
  maxDuration = 600,
  projectId
}: RecordingInterfaceProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      const chunks: BlobPart[] = []
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setRecordingState('reviewing')
        onRecordingComplete?.(blob, duration)
      }

      mediaRecorder.start()
      setRecordingState('recording')
      setDuration(0)

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1
          if (newDuration >= maxDuration) {
            stopRecording()
          }
          return newDuration
        })
      }, 1000)

    } catch (err) {
      setError('Failed to access microphone. Please check your permissions.')
      setRecordingState('error')
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause()
      setRecordingState('paused')
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume()
      setRecordingState('recording')
      
      intervalRef.current = setInterval(() => {
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

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }

  const playRecording = () => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioBlob(null)
    setAudioUrl(null)
    setDuration(0)
    setRecordingState('idle')
    setIsPlaying(false)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
      setPhotoPreview(null)
      setPhotoFile(null)
    }
  }

  const reRecord = () => {
    deleteRecording()
    startRecording()
  }

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setPhotoFile(file)
      const preview = URL.createObjectURL(file)
      setPhotoPreview(preview)
    }
  }

  const sendRecording = async () => {
    if (!audioBlob) return

    setRecordingState('uploading')
    setUploadProgress(0)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setUploadProgress(100)
      setRecordingState('complete')
      
      // Call completion handler
      onUploadComplete?.('mock-audio-url', photoFile ? 'mock-photo-url' : undefined)

    } catch (err) {
      setError('Failed to upload recording. Please try again.')
      setRecordingState('error')
    }
  }

  const resetInterface = () => {
    deleteRecording()
    setError(null)
    setUploadProgress(0)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [audioUrl, photoPreview])

  const getStateColor = () => {
    switch (recordingState) {
      case 'recording': return 'text-red-500'
      case 'paused': return 'text-yellow-500'
      case 'reviewing': return 'text-blue-500'
      case 'uploading': return 'text-primary'
      case 'complete': return 'text-success'
      case 'error': return 'text-destructive'
      default: return 'text-muted-foreground'
    }
  }

  const getStateText = () => {
    switch (recordingState) {
      case 'recording': return 'Recording...'
      case 'paused': return 'Paused'
      case 'reviewing': return 'Review Recording'
      case 'uploading': return 'Uploading...'
      case 'complete': return 'Upload Complete!'
      case 'error': return 'Error'
      default: return 'Ready to Record'
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card variant="elevated">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Mic className="w-5 h-5" />
            Record Your Story
          </CardTitle>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Badge variant="outline" className={getStateColor()}>
              {getStateText()}
            </Badge>
            <div className="text-2xl font-mono font-bold text-foreground">
              {formatDuration(duration)}
            </div>
            {maxDuration && (
              <div className="text-sm text-muted-foreground">
                / {formatDuration(maxDuration)}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Recording Controls */}
          {(recordingState === 'idle' || recordingState === 'error') && (
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Mic className="w-12 h-12 text-primary" />
              </div>
              <Button 
                variant="primary" 
                size="lg" 
                onClick={startRecording}
                className="px-8"
              >
                <Mic className="w-5 h-5 mr-2" />
                Start Recording
              </Button>
              <p className="text-sm text-muted-foreground">
                Press and hold to record your story. Maximum duration: {formatDuration(maxDuration)}
              </p>
            </div>
          )}

          {/* Active Recording Controls */}
          {(recordingState === 'recording' || recordingState === 'paused') && (
            <div className="text-center space-y-6">
              {/* Visual Feedback */}
              <div className="relative">
                <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center ${
                  recordingState === 'recording' 
                    ? 'bg-red-500/20 animate-pulse' 
                    : 'bg-yellow-500/20'
                }`}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    recordingState === 'recording' 
                      ? 'bg-red-500' 
                      : 'bg-yellow-500'
                  }`}>
                    <Mic className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                {/* Progress Ring */}
                <svg className="absolute inset-0 w-32 h-32 mx-auto -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 60}`}
                    strokeDashoffset={`${2 * Math.PI * 60 * (1 - duration / maxDuration)}`}
                    className="text-primary transition-all duration-1000"
                  />
                </svg>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-center gap-4">
                {recordingState === 'recording' ? (
                  <Button variant="secondary" onClick={pauseRecording}>
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </Button>
                ) : (
                  <Button variant="primary" onClick={resumeRecording}>
                    <Play className="w-5 h-5 mr-2" />
                    Resume
                  </Button>
                )}
                
                <Button variant="destructive" onClick={stopRecording}>
                  <Square className="w-5 h-5 mr-2" />
                  Stop
                </Button>
              </div>
            </div>
          )}

          {/* Review Screen */}
          {recordingState === 'reviewing' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-success/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Recording Complete!
                </h3>
                <p className="text-muted-foreground">
                  Review your recording and add a photo if you'd like.
                </p>
              </div>

              {/* Audio Playback */}
              <Card variant="information">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={playRecording}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <div>
                        <p className="font-medium text-foreground">Your Recording</p>
                        <p className="text-sm text-muted-foreground">
                          Duration: {formatDuration(duration)}
                        </p>
                      </div>
                    </div>
                    <Volume2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  
                  {audioUrl && (
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      onEnded={() => setIsPlaying(false)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      className="hidden"
                    />
                  )}
                </CardContent>
              </Card>

              {/* Photo Upload */}
              <Card variant="content">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-foreground">Add a Photo (Optional)</h4>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera className="w-4 h-4 mr-1" />
                        Choose Photo
                      </Button>
                    </div>
                    
                    {photoPreview && (
                      <div className="relative">
                        <img
                          src={photoPreview}
                          alt="Story photo"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (photoPreview) URL.revokeObjectURL(photoPreview)
                            setPhotoPreview(null)
                            setPhotoFile(null)
                          }}
                          className="absolute top-2 right-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-4">
                <Button variant="destructive-outline" onClick={deleteRecording}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
                <Button variant="secondary" onClick={reRecord}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Re-record
                </Button>
                <Button variant="primary" onClick={sendRecording}>
                  <Send className="w-4 h-4 mr-1" />
                  Send to Family
                </Button>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {recordingState === 'uploading' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Uploading Your Story...
                </h3>
                <div className="w-full bg-muted rounded-full h-2 mb-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {uploadProgress}% complete
                </p>
              </div>
            </div>
          )}

          {/* Success State */}
          {recordingState === 'complete' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-success/10 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Story Uploaded Successfully!
                </h3>
                <p className="text-muted-foreground mb-4">
                  Your family will be notified about your new story.
                </p>
                <Button variant="primary" onClick={resetInterface}>
                  Record Another Story
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {recordingState === 'error' && error && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Recording Error
                </h3>
                <p className="text-destructive mb-4">{error}</p>
                <Button variant="primary" onClick={() => {
                  setError(null)
                  setRecordingState('idle')
                }}>
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}