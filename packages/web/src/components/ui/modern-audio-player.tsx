'use client'

import * as React from "react"
import { cn } from "@/lib/utils"
import { Play, Pause, SkipBack, SkipForward, Volume2, Download } from "lucide-react"
import { EnhancedButton } from "./enhanced-button"

interface ModernAudioPlayerProps {
  src: string
  title?: string
  subtitle?: string
  className?: string
  showDownload?: boolean
  onDownload?: () => void
  onPrevSegment?: () => void
  onNextSegment?: () => void
}

export function ModernAudioPlayer({
  src,
  title,
  subtitle,
  className,
  showDownload = false,
  onDownload,
  onPrevSegment,
  onNextSegment,
}: ModernAudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [volume, setVolume] = React.useState(1)

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(vol)
    if (audioRef.current) {
      audioRef.current.volume = vol
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const skipBackward = () => {
    if (onPrevSegment) {
      onPrevSegment()
      return
    }
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10)
    }
  }

  const skipForward = () => {
    if (onNextSegment) {
      onNextSegment()
      return
    }
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10)
    }
  }

  return (
    <div className={cn("bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl p-6 border border-primary/10", className)}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-6">
          {title && <h3 className="font-semibold text-lg text-foreground mb-1">{title}</h3>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {/* Waveform Placeholder */}
      <div className="mb-6">
        <div className="flex items-center justify-center h-16 bg-primary/10 rounded-lg mb-2">
          <div className="flex items-end space-x-1 h-8">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 bg-primary/30 rounded-full transition-all duration-150",
                  i < (currentTime / duration) * 40 ? "bg-primary" : "bg-primary/20"
                )}
                style={{
                  height: `${Math.random() * 100 + 20}%`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="flex items-center space-x-3">
          <span className="text-xs text-muted-foreground font-mono">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer slider"
          />
          <span className="text-xs text-muted-foreground font-mono">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <EnhancedButton
            variant="ghost"
            size="icon"
            onClick={skipBackward}
            className="h-10 w-10 rounded-full hover:bg-primary/10"
          >
            <SkipBack className="h-4 w-4" />
          </EnhancedButton>
          
          <EnhancedButton
            variant="default"
            size="icon"
            onClick={togglePlayPause}
            className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </EnhancedButton>
          
          <EnhancedButton
            variant="ghost"
            size="icon"
            onClick={skipForward}
            className="h-10 w-10 rounded-full hover:bg-primary/10"
          >
            <SkipForward className="h-4 w-4" />
          </EnhancedButton>
        </div>

        <div className="flex items-center space-x-3">
          {/* Volume Control */}
          <div className="flex items-center space-x-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20 h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Download Button */}
          {showDownload && (
            <EnhancedButton
              variant="ghost"
              size="icon"
              onClick={onDownload}
              className="h-10 w-10 rounded-full hover:bg-primary/10"
            >
              <Download className="h-4 w-4" />
            </EnhancedButton>
          )}
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  )
}