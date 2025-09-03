import React from 'react'
import { Mic, MicOff, Square, Play, Pause, RotateCcw, AlertCircle } from 'lucide-react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Progress } from '@/components/ui/progress'
import { useAudioRecording } from '@/hooks/useAudioRecording'
import { formatTime } from '@/hooks/useAudioPlayer'

interface AudioRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, duration: number) => void
  onRecordingStart?: () => void
  onRecordingStop?: () => void
  disabled?: boolean
  className?: string
}

const MAX_DURATION = 20 * 60 * 1000 // 20 minutes in milliseconds

export function AudioRecorder({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  disabled = false,
  className
}: AudioRecorderProps) {
  const {
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
  } = useAudioRecording()

  const handleStartRecording = async () => {
    await startRecording()
    onRecordingStart?.()
  }

  const handleStopRecording = () => {
    stopRecording()
    onRecordingStop?.()
  }

  const handleRecordingComplete = () => {
    if (audioBlob && duration > 0) {
      onRecordingComplete?.(audioBlob, duration)
    }
  }

  // Calculate progress percentage
  const progressPercentage = (duration / MAX_DURATION) * 100

  // Format duration display
  const formattedDuration = formatTime(duration / 1000)
  const maxDurationFormatted = formatTime(MAX_DURATION / 1000)

  if (!isSupported) {
    return (
      <FurbridgeCard className={`p-6 ${className}`}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Audio Recording Not Supported
          </h3>
          <p className="text-gray-600">
            Your browser doesn't support audio recording. Please use a modern browser like Chrome, Firefox, or Safari.
          </p>
        </div>
      </FurbridgeCard>
    )
  }

  return (
    <FurbridgeCard className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Recording Status */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            {isRecording ? (
              <>
                <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-lg font-semibold">
                  {isPaused ? 'Recording Paused' : 'Recording...'}
                </span>
              </>
            ) : audioBlob ? (
              <>
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-lg font-semibold text-green-700">Recording Complete</span>
              </>
            ) : (
              <span className="text-lg font-semibold text-gray-600">Ready to Record</span>
            )}
          </div>
          
          {/* Duration Display */}
          <div className="text-2xl font-mono text-gray-900 mb-2">
            {formattedDuration} / {maxDurationFormatted}
          </div>
          
          {/* Progress Bar */}
          <div className="w-full max-w-md mx-auto">
            <Progress 
              value={progressPercentage} 
              className="h-2"
              indicatorClassName={
                progressPercentage > 90 ? 'bg-red-500' : 
                progressPercentage > 75 ? 'bg-yellow-500' : 
                'bg-furbridge-teal'
              }
            />
            <div className="text-xs text-gray-500 mt-1">
              {progressPercentage > 90 && 'Recording will stop automatically at 20 minutes'}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Recording Controls */}
        <div className="flex items-center justify-center space-x-4">
          {!isRecording && !audioBlob && (
            <FurbridgeButton
              onClick={handleStartRecording}
              disabled={disabled}
              size="lg"
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <Mic className="h-5 w-5 mr-2" />
              Start Recording
            </FurbridgeButton>
          )}

          {isRecording && (
            <>
              {!isPaused ? (
                <FurbridgeButton
                  onClick={pauseRecording}
                  variant="outline"
                  size="lg"
                >
                  <Pause className="h-5 w-5 mr-2" />
                  Pause
                </FurbridgeButton>
              ) : (
                <FurbridgeButton
                  onClick={resumeRecording}
                  size="lg"
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <Play className="h-5 w-5 mr-2" />
                  Resume
                </FurbridgeButton>
              )}

              <FurbridgeButton
                onClick={handleStopRecording}
                variant="outline"
                size="lg"
              >
                <Square className="h-5 w-5 mr-2" />
                Stop
              </FurbridgeButton>
            </>
          )}

          {audioBlob && (
            <>
              <FurbridgeButton
                onClick={handleRecordingComplete}
                size="lg"
                className="bg-furbridge-teal hover:bg-furbridge-teal/90 text-white"
              >
                Use This Recording
              </FurbridgeButton>

              <FurbridgeButton
                onClick={resetRecording}
                variant="outline"
                size="lg"
              >
                <RotateCcw className="h-5 w-5 mr-2" />
                Record Again
              </FurbridgeButton>
            </>
          )}
        </div>

        {/* Audio Preview */}
        {audioUrl && (
          <div className="border-t pt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Preview Recording</h4>
            <audio 
              controls 
              src={audioUrl} 
              className="w-full"
              preload="metadata"
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {/* Recording Tips */}
        {!isRecording && !audioBlob && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Recording Tips</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Find a quiet environment for the best audio quality</li>
              <li>• Speak clearly and at a normal pace</li>
              <li>• You can pause and resume recording as needed</li>
              <li>• Maximum recording time is 20 minutes</li>
              <li>• You can preview your recording before saving</li>
            </ul>
          </div>
        )}
      </div>
    </FurbridgeCard>
  )
}
