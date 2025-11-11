'use client'

// Recording interface with image upload support
import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'
import { 
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Volume2
} from 'lucide-react'
import { ImageUploader } from '@/components/images/ImageUploader'

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
  const t = useTranslations('recording')
  
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; file: File; preview: string }>>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

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
    // Clean up uploaded images
    uploadedImages.forEach(img => URL.revokeObjectURL(img.preview))
    setUploadedImages([])
  }

  const reRecord = () => {
    deleteRecording()
    startRecording()
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
      onUploadComplete?.('mock-audio-url')

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
      // Clean up image previews
      uploadedImages.forEach(img => URL.revokeObjectURL(img.preview))
    }
  }, [audioUrl, uploadedImages])

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
              {/* Review Header */}
              <div className="text-center">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {t('review.title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('review.subtitle')}
                </p>
              </div>
              
              {/* Image Upload Section */}
              <Card variant="content">
                <CardHeader>
                  <CardTitle>{t('review.addImages')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageUploader
                    maxImages={6}
                    images={uploadedImages}
                    onImagesChange={setUploadedImages}
                    showPreview={true}
                  />
                </CardContent>
              </Card>

              {/* Integrated Audio Player and Actions */}
              <Card variant="information">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Title */}
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <h4 className="font-medium text-foreground">{t('audio.listenTo')}</h4>
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(duration)}
                      </span>
                    </div>

                    {/* Audio Player Title */}
                    <div className="text-sm text-foreground">
                      {t('audio.yourRecording')}
                    </div>

                    {/* Playback Controls */}
                    <div className="flex items-center gap-3">
                      {/* Previous/Skip Back Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0"
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10)
                          }
                        }}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>

                      {/* Play/Pause Button */}
                      <Button
                        variant="primary"
                        size="sm"
                        className="h-10 w-10 p-0 rounded-full"
                        onClick={playRecording}
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </Button>

                      {/* Stop Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0"
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.pause()
                            audioRef.current.currentTime = 0
                            setIsPlaying(false)
                          }
                        }}
                      >
                        <Square className="w-4 h-4" />
                      </Button>

                      {/* Next/Skip Forward Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0"
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 10)
                          }
                        }}
                      >
                        <RotateCcw className="w-4 h-4 scale-x-[-1]" />
                      </Button>

                      {/* Volume Icon */}
                      <div className="flex-1 flex items-center justify-end">
                        <Volume2 className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        defaultValue="0"
                        className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        onChange={(e) => {
                          if (audioRef.current) {
                            const time = (parseFloat(e.target.value) / 100) * audioRef.current.duration
                            audioRef.current.currentTime = time
                          }
                        }}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>0:00</span>
                        <span>{formatDuration(duration)}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={reRecord}
                        className="flex-1"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        {t('actions.reRecord')}
                      </Button>
                      <Button 
                        variant="primary" 
                        size="sm"
                        onClick={sendRecording}
                        className="flex-1"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        {t('actions.complete')}
                      </Button>
                    </div>
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

              {/* Hint Text */}
              <p className="text-center text-sm text-muted-foreground">
                {t('tips.traditional')}
              </p>
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