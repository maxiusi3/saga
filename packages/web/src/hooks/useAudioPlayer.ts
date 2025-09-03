import { useState, useRef, useCallback, useEffect } from 'react'

export interface AudioPlayerState {
  isPlaying: boolean
  isLoading: boolean
  duration: number
  currentTime: number
  volume: number
  isMuted: boolean
  error: string | null
  canPlay: boolean
}

export interface AudioPlayerControls {
  play: () => void
  pause: () => void
  stop: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  load: (src: string) => void
}

export function useAudioPlayer(initialSrc?: string): AudioPlayerState & AudioPlayerControls {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canPlay, setCanPlay] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    // Set up event listeners
    const handleLoadStart = () => {
      setIsLoading(true)
      setError(null)
      setCanPlay(false)
    }

    const handleCanPlay = () => {
      setIsLoading(false)
      setCanPlay(true)
      setDuration(audio.duration || 0)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    const handleError = () => {
      setIsLoading(false)
      setIsPlaying(false)
      setCanPlay(false)
      setError('Failed to load audio. Please check the audio file and try again.')
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleVolumeChange = () => {
      setVolumeState(audio.volume)
      setIsMuted(audio.muted)
    }

    // Add event listeners
    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('volumechange', handleVolumeChange)

    // Load initial source if provided
    if (initialSrc) {
      audio.src = initialSrc
      audio.load()
    }

    return () => {
      // Clean up event listeners
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('volumechange', handleVolumeChange)

      // Clean up audio element
      audio.pause()
      audio.src = ''
      audio.load()
    }
  }, [initialSrc])

  // Update current time periodically when playing
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      intervalRef.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime)
        }
      }, 100)
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
  }, [isPlaying])

  const play = useCallback(() => {
    if (audioRef.current && canPlay) {
      audioRef.current.play().catch((err) => {
        console.error('Error playing audio:', err)
        setError('Failed to play audio. Please try again.')
        setIsPlaying(false)
      })
    }
  }, [canPlay])

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setCurrentTime(0)
    }
  }, [])

  const seek = useCallback((time: number) => {
    if (audioRef.current && canPlay) {
      const clampedTime = Math.max(0, Math.min(time, duration))
      audioRef.current.currentTime = clampedTime
      setCurrentTime(clampedTime)
    }
  }, [canPlay, duration])

  const setVolume = useCallback((newVolume: number) => {
    if (audioRef.current) {
      const clampedVolume = Math.max(0, Math.min(1, newVolume))
      audioRef.current.volume = clampedVolume
      setVolumeState(clampedVolume)
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted
      setIsMuted(audioRef.current.muted)
    }
  }, [])

  const load = useCallback((src: string) => {
    if (audioRef.current) {
      setError(null)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setCanPlay(false)
      
      audioRef.current.src = src
      audioRef.current.load()
    }
  }, [])

  return {
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
  }
}

// Utility function to format time in MM:SS format
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
