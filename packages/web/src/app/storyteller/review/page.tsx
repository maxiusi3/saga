'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Play, Pause, RotateCcw, Send, Trash2, Clock } from 'lucide-react'
import { Suspense } from 'react'

interface RecordingData {
  audioBlob: Blob
  duration: number
  prompt: string
  category: string
  projectId: string
}

function ReviewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [recordingData, setRecordingData] = useState<RecordingData | null>(null)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrl = useRef<string>('')

  useEffect(() => {
    // In a real app, this would come from the recording page via state or URL params
    // For now, we'll simulate having recording data
    const mockRecordingData: RecordingData = {
      audioBlob: new Blob(), // This would be the actual audio blob
      duration: 180, // 3 minutes
      prompt: 'Tell me about your first job. What was it like walking in on your first day?',
      category: 'Career',
      projectId: '1'
    }
    
    setRecordingData(mockRecordingData)
    setDuration(mockRecordingData.duration)
    
    // Create audio URL for playback
    // audioUrl.current = URL.createObjectURL(mockRecordingData.audioBlob)
    
    return () => {
      if (audioUrl.current) {
        URL.revokeObjectURL(audioUrl.current)
      }
    }
  }, [])

  const handlePlayPause = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSendToFamily = async () => {
    if (!recordingData) return
    
    setIsUploading(true)
    setUploadProgress(0)
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval)
            return 100
          }
          return prev + 10
        })
      }, 200)
      
      // TODO: Implement actual upload to Supabase
      // 1. Upload audio file to storage
      // 2. Create story record in database
      // 3. Notify family members
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Redirect to success page
      router.push('/storyteller/success')
      
    } catch (error) {
      console.error('Upload failed:', error)
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleReRecord = () => {
    router.push('/storyteller/record')
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
      router.push('/storyteller')
    }
  }

  if (!recordingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-furbridge-orange"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            Review Your Story
          </h1>
          <p className="text-gray-600">
            Listen to your recording before sending it to your family
          </p>
        </div>

        {/* Prompt Card */}
        <FurbridgeCard className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="bg-furbridge-orange/10 text-furbridge-orange">
                {recordingData.category}
              </Badge>
              <div className="flex items-center space-x-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span className="text-sm">{formatTime(duration)}</span>
              </div>
            </div>
            
            <p className="text-lg text-gray-900 leading-relaxed">
              "{recordingData.prompt}"
            </p>
          </div>
        </FurbridgeCard>

        {/* Audio Player */}
        <FurbridgeCard className="p-8">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Your Recording
              </h2>
              
              {/* Play/Pause Button */}
              <FurbridgeButton
                variant="orange"
                size="lg"
                onClick={handlePlayPause}
                className="w-20 h-20 rounded-full p-0"
              >
                {isPlaying ? (
                  <Pause className="h-8 w-8" />
                ) : (
                  <Play className="h-8 w-8 ml-1" />
                )}
              </FurbridgeButton>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={duration}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-sm text-gray-600">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Hidden Audio Element */}
            <audio
              ref={audioRef}
              src={audioUrl.current}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </div>
        </FurbridgeCard>

        {/* Upload Progress */}
        {isUploading && (
          <FurbridgeCard className="p-6">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Sending to Family...
                </h3>
                <p className="text-sm text-gray-600">
                  Please don't close this page while uploading
                </p>
              </div>
              
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-3" />
                <div className="text-center text-sm text-gray-600">
                  {uploadProgress}% complete
                </div>
              </div>
            </div>
          </FurbridgeCard>
        )}

        {/* Action Buttons */}
        {!isUploading && (
          <div className="space-y-4">
            {/* Primary Action */}
            <FurbridgeButton
              variant="orange"
              size="lg"
              className="w-full"
              onClick={handleSendToFamily}
            >
              <Send className="h-5 w-5 mr-2" />
              Send to Family
            </FurbridgeButton>

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-4">
              <FurbridgeButton
                variant="outline"
                onClick={handleReRecord}
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Re-record
              </FurbridgeButton>
              
              <FurbridgeButton
                variant="outline"
                onClick={handleDelete}
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </FurbridgeButton>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-center text-sm text-gray-600">
          <p>
            Your story will be shared with all family members in this project.
            <br />
            You can always edit or delete it later.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-furbridge-orange"></div>
      </div>
    }>
      <ReviewPageContent />
    </Suspense>
  )
}
