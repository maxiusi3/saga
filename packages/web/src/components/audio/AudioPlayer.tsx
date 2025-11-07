import React, { useEffect } from 'react'
import { Play, Pause, Square, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react'
import { Button as FurbridgeButton } from "@/components/ui/button"
import { Slider } from '@/components/ui/slider'
import { useAudioPlayer, formatTime } from '@/hooks/useAudioPlayer'

interface AudioPlayerProps {
  src: string
  title?: string
  className?: string
  compact?: boolean
  autoPlay?: boolean
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
}

export function AudioPlayer({
  src,
  title,
  className = '',
  compact = false,
  autoPlay = false,
  onPlay,
  onPause,
  onEnded
}: AudioPlayerProps) {
  const {
    isPlaying,
    isLoading,
    duration,
    currentTime,
    volume,
    isMuted,
    error,
    canPlay,
    play,
    pause,
    stop,
    seek,
    setVolume,
    toggleMute,
    load,
  } = useAudioPlayer()

  // Load audio source when component mounts or src changes
  useEffect(() => {
    if (src) {
      load(src)
    }
  }, [src, load])

  // Auto-play if requested
  useEffect(() => {
    if (autoPlay && canPlay && !isPlaying) {
      play()
    }
  }, [autoPlay, canPlay, isPlaying, play])

  // Handle play/pause callbacks
  useEffect(() => {
    if (isPlaying) {
      onPlay?.()
    } else {
      onPause?.()
    }
  }, [isPlaying, onPlay, onPause])

  // Handle ended callback
  useEffect(() => {
    if (currentTime > 0 && currentTime >= duration && duration > 0) {
      onEnded?.()
    }
  }, [currentTime, duration, onEnded])

  const handlePlayPause = () => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }

  const handleSeek = (value: number[]) => {
    seek(value[0])
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0])
  }

  const handleSkipBack = () => {
    seek(Math.max(0, currentTime - 10))
  }

  const handleSkipForward = () => {
    seek(Math.min(duration, currentTime + 10))
  }

  if (error) {
    return (
      <div className={`bg-destructive/10 border-destructive/20 rounded-lg p-4 ${className}`}>
        <p className="text-destructive text-sm">{error}</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <FurbridgeButton
          onClick={handlePlayPause}
          disabled={!canPlay || isLoading}
          size="sm"
          variant="ghost"
          className="flex-shrink-0"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </FurbridgeButton>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground font-mono">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                disabled={!canPlay}
                className="w-full"
              />
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {formatTime(duration)}
            </span>
          </div>
          {title && (
            <p className="text-sm text-muted-foreground truncate mt-1">{title}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-background border rounded-lg p-4 space-y-4 ${className}`}>
      {/* Title */}
      {title && (
        <h3 className="text-lg font-semibold text-foreground truncate">{title}</h3>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          disabled={!canPlay}
          className="w-full"
        />
        <div className="flex justify-between text-sm text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center space-y-3">
        {/* Playback Controls - Centered */}
        <div className="flex items-center justify-center space-x-2">
          {/* Skip Back */}
          <FurbridgeButton
            onClick={handleSkipBack}
            disabled={!canPlay}
            size="sm"
            variant="ghost"
          >
            <SkipBack className="h-4 w-4" />
          </FurbridgeButton>

          {/* Play/Pause */}
          <FurbridgeButton
            onClick={handlePlayPause}
            disabled={!canPlay || isLoading}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </FurbridgeButton>

          {/* Stop */}
          <FurbridgeButton
            onClick={stop}
            disabled={!canPlay}
            size="sm"
            variant="ghost"
          >
            <Square className="h-4 w-4" />
          </FurbridgeButton>

          {/* Skip Forward */}
          <FurbridgeButton
            onClick={handleSkipForward}
            disabled={!canPlay}
            size="sm"
            variant="ghost"
          >
            <SkipForward className="h-4 w-4" />
          </FurbridgeButton>
        </div>

        {/* Volume Controls - Centered */}
        <div className="flex items-center justify-center space-x-2">
          <FurbridgeButton
            onClick={toggleMute}
            size="sm"
            variant="ghost"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </FurbridgeButton>
          <div className="w-32">
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center text-sm text-muted-foreground">
          Loading audio...
        </div>
      )}
    </div>
  )
}
