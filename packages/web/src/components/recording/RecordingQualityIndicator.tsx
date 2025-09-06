'use client'

import React, { useEffect, useState, useRef } from 'react'

interface RecordingQualityIndicatorProps {
  stream: MediaStream | null
  isRecording: boolean
  className?: string
}

type QualityLevel = 'poor' | 'fair' | 'good' | 'excellent'

export function RecordingQualityIndicator({ 
  stream, 
  isRecording, 
  className = '' 
}: RecordingQualityIndicatorProps) {
  const [audioLevel, setAudioLevel] = useState(0)
  const [qualityLevel, setQualityLevel] = useState<QualityLevel>('good')
  const [qualityMessage, setQualityMessage] = useState('')
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (stream && isRecording) {
      setupAudioAnalysis()
    } else {
      cleanup()
    }

    return cleanup
  }, [stream, isRecording])

  const setupAudioAnalysis = () => {
    if (!stream) return

    try {
      // Create audio context and analyser
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      
      analyserRef.current.fftSize = 256
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      const updateAudioLevel = () => {
        if (!analyserRef.current || !isRecording) return
        
        analyserRef.current.getByteFrequencyData(dataArray)
        
        // Calculate average audio level
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength
        const normalizedLevel = average / 255 * 100
        
        setAudioLevel(normalizedLevel)
        updateQualityAssessment(normalizedLevel, dataArray)
        
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      }
      
      updateAudioLevel()
    } catch (error) {
      console.error('Failed to setup audio analysis:', error)
    }
  }

  const updateQualityAssessment = (level: number, frequencyData: Uint8Array) => {
    let quality: QualityLevel = 'good'
    let message = ''

    // Assess audio quality based on level and frequency distribution
    if (level < 5) {
      quality = 'poor'
      message = 'Speak louder or move closer to your microphone'
    } else if (level < 15) {
      quality = 'fair'
      message = 'Audio is a bit quiet - try speaking a little louder'
    } else if (level > 80) {
      quality = 'fair'
      message = 'Audio might be too loud - try speaking softer or moving back'
    } else {
      // Check for good frequency distribution
      const lowFreq = frequencyData.slice(0, 10).reduce((sum, val) => sum + val, 0) / 10
      const midFreq = frequencyData.slice(10, 50).reduce((sum, val) => sum + val, 0) / 40
      const highFreq = frequencyData.slice(50, 100).reduce((sum, val) => sum + val, 0) / 50

      if (midFreq > lowFreq * 0.5 && midFreq > highFreq * 0.3) {
        quality = 'excellent'
        message = 'Excellent audio quality!'
      } else {
        quality = 'good'
        message = 'Good audio quality'
      }
    }

    setQualityLevel(quality)
    setQualityMessage(message)
  }

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    analyserRef.current = null
  }

  const getQualityColor = () => {
    switch (qualityLevel) {
      case 'poor': return 'text-destructive'
      case 'fair': return 'text-yellow-500'
      case 'good': return 'text-primary'
      case 'excellent': return 'text-success'
      default: return 'text-muted-foreground'
    }
  }

  const getQualityIcon = () => {
    switch (qualityLevel) {
      case 'poor': return '🔴'
      case 'fair': return '🟡'
      case 'good': return '🔵'
      case 'excellent': return '🟢'
      default: return '⚪'
    }
  }

  if (!isRecording || !stream) {
    return null
  }

  return (
    <div className={`text-center space-y-3 ${className}`}>
      {/* Audio Level Meter */}
      <div className="flex items-center justify-center space-x-2">
        <span className="text-sm font-medium">Audio Level:</span>
        <div className="w-32 h-3 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-success/80 to-success transition-all duration-100"
            style={{ width: `${Math.min(audioLevel, 100)}%` }}
          />
        </div>
        <span className="text-sm font-mono w-8">{Math.round(audioLevel)}%</span>
      </div>

      {/* Quality Indicator */}
      <div className={`flex items-center justify-center space-x-2 ${getQualityColor()}`}>
        <span className="text-lg">{getQualityIcon()}</span>
        <span className="font-medium capitalize">{qualityLevel} Quality</span>
      </div>

      {/* Quality Message */}
      {qualityMessage && (
        <div className="text-sm text-muted-foreground max-w-xs mx-auto">
          {qualityMessage}
        </div>
      )}

      {/* Visual Audio Bars */}
      <div className="flex items-end justify-center space-x-1 h-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className={`w-2 bg-gradient-to-t from-primary/80 to-primary rounded-t transition-all duration-100 ${
              audioLevel > (i + 1) * 12.5 ? 'opacity-100' : 'opacity-30'
            }`}
            style={{ 
              height: `${Math.max(4, Math.min(32, (audioLevel / 100) * 32))}px` 
            }}
          />
        ))}
      </div>
    </div>
  )
}