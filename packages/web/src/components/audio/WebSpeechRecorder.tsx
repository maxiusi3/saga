'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mic, MicOff, Square, Play, Pause, RotateCcw, AlertCircle, Volume2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface WebSpeechRecorderProps {
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void
  onRecordingComplete?: (finalTranscript: string, audioBlob?: Blob) => void
  onError?: (error: string) => void
  language?: string
  continuous?: boolean
  interimResults?: boolean
  maxDuration?: number // in seconds
  className?: string
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export function WebSpeechRecorder({
  onTranscriptUpdate,
  onRecordingComplete,
  onError,
  language = 'zh-CN',
  continuous = true,
  interimResults = true,
  maxDuration = 1200, // 20 minutes
  className = ''
}: WebSpeechRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [duration, setDuration] = useState(0)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const recognitionRef = useRef<any>(null)
  const startTimeRef = useRef<number>(0)
  const pausedTimeRef = useRef<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const finalTranscriptRef = useRef('')
  
  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)
    
    if (!SpeechRecognition) {
      setError('您的浏览器不支持语音识别功能。请使用 Chrome、Edge 或 Safari 浏览器。')
    }
  }, [])

  // Update duration timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current - pausedTimeRef.current
        setDuration(Math.floor(elapsed / 1000))
        
        // Auto-stop at max duration
        if (elapsed >= maxDuration * 1000) {
          stopRecording()
          toast.error(`录音已达到最大时长 ${maxDuration / 60} 分钟，自动停止`)
        }
      }, 1000)
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
  }, [isRecording, isPaused, maxDuration])

  const initializeRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return null

    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = language
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      console.log('语音识别已开始')
      setError(null)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }

      if (finalText) {
        finalTranscriptRef.current += finalText
        setTranscript(finalTranscriptRef.current)
        onTranscriptUpdate?.(finalTranscriptRef.current, true)
      }

      if (interimText) {
        setInterimTranscript(interimText)
        onTranscriptUpdate?.(finalTranscriptRef.current + interimText, false)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('语音识别错误:', event.error)
      let errorMessage = '语音识别出现错误'
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = '未检测到语音，请重试'
          break
        case 'audio-capture':
          errorMessage = '无法访问麦克风，请检查权限设置'
          break
        case 'not-allowed':
          errorMessage = '麦克风权限被拒绝，请允许访问麦克风'
          break
        case 'network':
          errorMessage = '网络连接错误，请检查网络连接'
          break
        case 'service-not-allowed':
          errorMessage = '语音识别服务不可用'
          break
        default:
          errorMessage = `语音识别错误: ${event.error}`
      }
      
      setError(errorMessage)
      onError?.(errorMessage)
      setIsRecording(false)
      setIsPaused(false)
    }

    recognition.onend = () => {
      console.log('语音识别已结束')
      if (isRecording && !isPaused) {
        // 如果还在录音状态但识别结束了，重新启动
        setTimeout(() => {
          if (recognitionRef.current && isRecording && !isPaused) {
            try {
              recognitionRef.current.start()
            } catch (err) {
              console.error('重启语音识别失败:', err)
            }
          }
        }, 100)
      }
    }

    return recognition
  }, [language, continuous, interimResults, isRecording, isPaused, onTranscriptUpdate, onError])

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      const errorMsg = '您的浏览器不支持语音识别功能'
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    try {
      setError(null)
      
      // 请求麦克风权限
      await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const recognition = initializeRecognition()
      if (!recognition) {
        throw new Error('无法初始化语音识别')
      }

      recognitionRef.current = recognition
      finalTranscriptRef.current = ''
      setTranscript('')
      setInterimTranscript('')
      setDuration(0)
      
      recognition.start()
      setIsRecording(true)
      setIsPaused(false)
      startTimeRef.current = Date.now()
      pausedTimeRef.current = 0
      
      toast.success('开始语音识别录音')
    } catch (err) {
      console.error('启动录音失败:', err)
      let errorMessage = '启动录音失败'
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = '麦克风权限被拒绝，请允许访问麦克风'
        } else if (err.name === 'NotFoundError') {
          errorMessage = '未找到麦克风设备，请连接麦克风'
        } else {
          errorMessage = err.message || '启动录音失败'
        }
      }
      
      setError(errorMessage)
      onError?.(errorMessage)
    }
  }, [isSupported, initializeRecognition, onError])

  const pauseRecording = useCallback(() => {
    if (recognitionRef.current && isRecording && !isPaused) {
      recognitionRef.current.stop()
      setIsPaused(true)
      pausedTimeRef.current += Date.now() - startTimeRef.current
      toast.info('录音已暂停')
    }
  }, [isRecording, isPaused])

  const resumeRecording = useCallback(() => {
    if (recognitionRef.current && isRecording && isPaused) {
      try {
        recognitionRef.current.start()
        setIsPaused(false)
        startTimeRef.current = Date.now()
        toast.success('录音已恢复')
      } catch (err) {
        console.error('恢复录音失败:', err)
        setError('恢复录音失败')
      }
    }
  }, [isRecording, isPaused])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    
    setIsRecording(false)
    setIsPaused(false)
    setInterimTranscript('')
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    const finalText = finalTranscriptRef.current.trim()
    if (finalText) {
      onRecordingComplete?.(finalText)
      toast.success('录音完成')
    } else {
      toast.warning('未检测到有效语音内容')
    }
  }, [onRecordingComplete])

  const resetRecording = useCallback(() => {
    stopRecording()
    setTranscript('')
    setInterimTranscript('')
    setDuration(0)
    setError(null)
    finalTranscriptRef.current = ''
  }, [stopRecording])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!isSupported) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            浏览器不支持语音识别
          </h3>
          <p className="text-muted-foreground mb-4">
            请使用 Chrome、Edge 或 Safari 浏览器以获得最佳体验
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* 状态显示 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              isRecording 
                ? isPaused 
                  ? 'bg-yellow-500' 
                  : 'bg-red-500 animate-pulse'
                : 'bg-gray-300'
            }`} />
            <span className="text-sm font-medium">
              {isRecording 
                ? isPaused 
                  ? '已暂停' 
                  : '正在录音'
                : '准备录音'
              }
            </span>
            <Badge variant="outline">
              {formatTime(duration)}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Volume2 className="h-4 w-4" />
            <span>语音识别</span>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex justify-center space-x-4">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              size="lg"
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <Mic className="h-5 w-5 mr-2" />
              开始录音
            </Button>
          ) : (
            <>
              {!isPaused ? (
                <Button
                  onClick={pauseRecording}
                  variant="outline"
                  size="lg"
                >
                  <Pause className="h-5 w-5 mr-2" />
                  暂停
                </Button>
              ) : (
                <Button
                  onClick={resumeRecording}
                  size="lg"
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <Play className="h-5 w-5 mr-2" />
                  继续
                </Button>
              )}
              
              <Button
                onClick={stopRecording}
                variant="outline"
                size="lg"
              >
                <Square className="h-5 w-5 mr-2" />
                停止
              </Button>
            </>
          )}
          
          {(transcript || interimTranscript) && (
            <Button
              onClick={resetRecording}
              variant="ghost"
              size="lg"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              重新开始
            </Button>
          )}
        </div>

        {/* 转录文本显示 */}
        {(transcript || interimTranscript) && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">实时转录:</h4>
            <div className="bg-muted/50 rounded-lg p-4 min-h-[100px] max-h-[300px] overflow-y-auto">
              <p className="text-sm leading-relaxed">
                <span className="text-foreground">{transcript}</span>
                {interimTranscript && (
                  <span className="text-muted-foreground italic">
                    {interimTranscript}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">错误</p>
                <p className="text-sm text-destructive/80 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 使用提示 */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• 请确保麦克风权限已开启</p>
          <p>• 建议在安静环境中录音以获得最佳识别效果</p>
          <p>• 支持中文、英文等多种语言识别</p>
        </div>
      </div>
    </Card>
  )
}
