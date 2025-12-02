'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mic, Square, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeepDiveRecorderProps {
    onRecordingComplete: (result: { audioBlob: Blob, transcript: string, duration: number }) => void
    promptText?: string
    locale?: string
}

export function DeepDiveRecorder({ onRecordingComplete, promptText, locale = 'en' }: DeepDiveRecorderProps) {
    const [isRecording, setIsRecording] = useState(false)
    const [duration, setDuration] = useState(0)
    const [isOnline, setIsOnline] = useState(true)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const [transcript, setTranscript] = useState('')
    const recognitionRef = useRef<any>(null)

    useEffect(() => {
        setIsOnline(navigator.onLine)
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // Initialize Speech Recognition
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition()
                recognition.continuous = true
                recognition.interimResults = true
                recognition.lang = locale === 'zh' ? 'zh-CN' : 'en-US'

                recognition.onresult = (event: any) => {
                    let finalTranscript = ''
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript
                        }
                    }
                    if (finalTranscript) {
                        setTranscript(prev => prev + ' ' + finalTranscript)
                    }
                }

                recognitionRef.current = recognition
            }
        }

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            if (timerRef.current) clearInterval(timerRef.current)
            if (recognitionRef.current) recognitionRef.current.stop()
        }
    }, [locale])

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                onRecordingComplete({
                    audioBlob: blob,
                    transcript: transcript,
                    duration: duration
                })
                stream.getTracks().forEach(track => track.stop())
            }

            mediaRecorder.start(1000) // Collect chunks every second
            setIsRecording(true)

            // Start Speech Recognition
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.start()
                } catch (e) {
                    console.error('Speech recognition failed to start:', e)
                }
            }

            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1)
            }, 1000)

        } catch (err) {
            console.error('Failed to start recording:', err)
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            if (timerRef.current) clearInterval(timerRef.current)
            if (recognitionRef.current) recognitionRef.current.stop()
        }
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-4">
                <h2 className="text-3xl font-serif font-medium text-stone-800 dark:text-stone-100">
                    Record Your Story
                </h2>
                <p className="text-stone-500 dark:text-stone-400">
                    Share your memories with AI-powered guidance
                </p>
            </div>

            <Card className="p-8 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 shadow-xl">
                <div className="flex justify-between items-start mb-8">
                    <h3 className="font-medium text-lg">Record Your Story</h3>
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                        {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-amber-500" />}
                        {isOnline ? 'Online' : 'Offline Mode'}
                    </div>
                </div>

                {promptText && (
                    <div className="bg-stone-50 dark:bg-stone-800/50 p-6 rounded-xl mb-8">
                        <span className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2 block">Prompt:</span>
                        <p className="text-lg font-serif text-stone-800 dark:text-stone-200 leading-relaxed">
                            {promptText}
                        </p>
                    </div>
                )}

                <div className="flex flex-col items-center justify-center space-y-8 py-8">
                    <div className="text-center space-y-2">
                        <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">
                            {isRecording ? 'Recording in Progress' : 'Ready to Record'}
                        </p>
                        <div className="text-6xl font-mono font-light tabular-nums tracking-tight text-stone-900 dark:text-stone-100">
                            {formatTime(duration)}
                        </div>
                        {isRecording && (
                            <div className="h-1 w-32 bg-stone-100 rounded-full overflow-hidden mx-auto mt-4">
                                <div className="h-full bg-red-500 animate-progress-indeterminate" />
                            </div>
                        )}
                    </div>

                    {/* Real-time Transcript */}
                    <div className="w-full max-w-lg min-h-[60px] text-center">
                        {transcript ? (
                            <p className="text-stone-600 dark:text-stone-300 animate-in fade-in">
                                "{transcript}"
                            </p>
                        ) : isRecording ? (
                            <p className="text-stone-400 text-sm italic animate-pulse">
                                Listening...
                            </p>
                        ) : null}
                    </div>

                    <Button
                        size="lg"
                        className={cn(
                            "h-20 px-12 text-lg rounded-full shadow-lg transition-all duration-300",
                            isRecording
                                ? "bg-red-500 hover:bg-red-600 text-white"
                                : "bg-red-500 hover:bg-red-600 text-white hover:scale-105"
                        )}
                        onClick={isRecording ? stopRecording : startRecording}
                    >
                        {isRecording ? (
                            <>
                                <Square className="w-6 h-6 mr-3 fill-current" />
                                Stop Recording
                            </>
                        ) : (
                            <>
                                <Mic className="w-6 h-6 mr-3" />
                                Start Recording
                            </>
                        )}
                    </Button>

                    <p className="text-xs text-stone-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400/50" />
                        Using real-time speech recognition
                    </p>
                </div>
            </Card>
        </div>
    )
}
