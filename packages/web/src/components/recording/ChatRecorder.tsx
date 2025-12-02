'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'react-hot-toast'
import { Mic, Square, Play, Trash2, Send, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatRecorderProps {
    onRecordingComplete: (result: { audioBlob: Blob, duration: number }) => void
}

interface AudioBubble {
    id: string
    blob: Blob
    url: string
    duration: number
}

export function ChatRecorder({ onRecordingComplete }: ChatRecorderProps) {
    const [isRecording, setIsRecording] = useState(false)
    const [duration, setDuration] = useState(0)
    const [bubbles, setBubbles] = useState<AudioBubble[]>([])
    const [isPlaying, setIsPlaying] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const durationRef = useRef(0)

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            bubbles.forEach(b => URL.revokeObjectURL(b.url))
        }
    }, [])

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
                const url = URL.createObjectURL(blob)
                const newBubble: AudioBubble = {
                    id: Date.now().toString(),
                    blob,
                    url,
                    duration: durationRef.current
                }
                setBubbles(prev => [...prev, newBubble])
                setDuration(0)
                durationRef.current = 0
                stream.getTracks().forEach(track => track.stop())
            }

            mediaRecorder.start()
            setIsRecording(true)

            timerRef.current = setInterval(() => {
                setDuration(prev => {
                    const next = prev + 1
                    durationRef.current = next
                    return next
                })
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
        }
    }

    const playBubble = (bubble: AudioBubble) => {
        if (audioRef.current) {
            audioRef.current.pause()
            if (isPlaying === bubble.id) {
                setIsPlaying(null)
                return
            }
        }

        const audio = new Audio(bubble.url)
        audioRef.current = audio
        audio.onended = () => setIsPlaying(null)
        audio.play()
        setIsPlaying(bubble.id)
    }

    const deleteBubble = (id: string) => {
        setBubbles(prev => prev.filter(b => b.id !== id))
        if (isPlaying === id) {
            audioRef.current?.pause()
            setIsPlaying(null)
        }
    }

    const audioBufferToWav = (buffer: AudioBuffer): Blob => {
        const numOfChan = buffer.numberOfChannels
        const length = buffer.length * numOfChan * 2 + 44
        const bufferArr = new ArrayBuffer(length)
        const view = new DataView(bufferArr)
        const channels = []
        let i
        let sample
        let offset = 0
        let pos = 0

        // write WAVE header
        setUint32(0x46464952) // "RIFF"
        setUint32(length - 8) // file length - 8
        setUint32(0x45564157) // "WAVE"

        setUint32(0x20746d66) // "fmt " chunk
        setUint32(16) // length = 16
        setUint16(1) // PCM (uncompressed)
        setUint16(numOfChan)
        setUint32(buffer.sampleRate)
        setUint32(buffer.sampleRate * 2 * numOfChan) // avg. bytes/sec
        setUint16(numOfChan * 2) // block-align
        setUint16(16) // 16-bit (hardcoded in this example)

        setUint32(0x61746164) // "data" - chunk
        setUint32(length - pos - 4) // chunk length

        // write interleaved data
        for (i = 0; i < buffer.numberOfChannels; i++)
            channels.push(buffer.getChannelData(i))

        while (pos < buffer.length) {
            for (i = 0; i < numOfChan; i++) {
                // interleave channels
                sample = Math.max(-1, Math.min(1, channels[i][pos])) // clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0 // scale to 16-bit signed int
                view.setInt16(44 + offset, sample, true) // write 16-bit sample
                offset += 2
            }
            pos++
        }

        // helper functions
        function setUint16(data: number) {
            view.setUint16(pos, data, true)
            pos += 2
        }

        function setUint32(data: number) {
            view.setUint32(pos, data, true)
            pos += 4
        }

        return new Blob([bufferArr], { type: 'audio/wav' })
    }

    const handleFinish = async () => {
        if (bubbles.length === 0) return
        setIsProcessing(true)

        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            const audioBuffers: AudioBuffer[] = []

            // Decode all blobs
            for (const bubble of bubbles) {
                try {
                    const arrayBuffer = await bubble.blob.arrayBuffer()
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
                    audioBuffers.push(audioBuffer)
                } catch (e) {
                    console.error('Failed to decode bubble:', bubble.id, e)
                }
            }

            if (audioBuffers.length === 0) {
                throw new Error('No valid audio to merge')
            }

            // Calculate total length
            const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.length, 0)
            const outputBuffer = audioContext.createBuffer(
                audioBuffers[0].numberOfChannels,
                totalLength,
                audioBuffers[0].sampleRate
            )

            // Merge
            let offset = 0
            for (const buf of audioBuffers) {
                for (let channel = 0; channel < buf.numberOfChannels; channel++) {
                    outputBuffer.getChannelData(channel).set(buf.getChannelData(channel), offset)
                }
                offset += buf.length
            }

            // Encode to WAV
            const mergedBlob = audioBufferToWav(outputBuffer)

            // Calculate EXACT duration from the merged buffer
            const totalDuration = outputBuffer.duration

            console.log('Merged Audio Duration:', totalDuration)

            onRecordingComplete({
                audioBlob: mergedBlob,
                duration: totalDuration
            })
        } catch (error) {
            console.error('Error merging audio:', error)
            toast.error('Failed to process audio. Please try again.')
        } finally {
            setIsProcessing(false)
        }
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="flex flex-col h-[600px] max-w-md mx-auto bg-white dark:bg-stone-900 rounded-2xl shadow-xl overflow-hidden border border-stone-200 dark:border-stone-800">
            {/* Chat Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-stone-50 dark:bg-stone-950">
                <AnimatePresence>
                    {bubbles.map((bubble) => (
                        <motion.div
                            key={bubble.id}
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex justify-end"
                        >
                            <div className="flex items-center gap-2 max-w-[80%]">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-stone-400 hover:text-red-500"
                                    onClick={() => deleteBubble(bubble.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                                <div
                                    className={cn(
                                        "p-3 rounded-2xl rounded-tr-sm flex items-center gap-3 cursor-pointer transition-colors",
                                        isPlaying === bubble.id
                                            ? "bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900"
                                            : "bg-white border border-stone-200 dark:bg-stone-800 dark:border-stone-700"
                                    )}
                                    onClick={() => playBubble(bubble)}
                                >
                                    {isPlaying === bubble.id ? (
                                        <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                                    ) : (
                                        <Play className="w-4 h-4 fill-current" />
                                    )}
                                    <div className="flex flex-col">
                                        <span className="text-xs opacity-70">Voice Note</span>
                                        <span className="text-sm font-medium">{formatTime(bubble.duration)}</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {bubbles.length === 0 && !isRecording && (
                    <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-2">
                        <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-900 flex items-center justify-center">
                            <Mic className="w-6 h-6" />
                        </div>
                        <p className="text-sm">Tap microphone to start</p>
                    </div>
                )}
            </div>

            {/* Controls Area */}
            <div className="p-4 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800">
                <div className="flex items-center justify-between gap-4">
                    {/* Recording Status / Timer */}
                    <div className="w-20 text-sm font-mono font-medium text-stone-500">
                        {isRecording ? (
                            <span className="text-red-500 animate-pulse flex items-center gap-1">
                                <div className="w-2 h-2 bg-red-500 rounded-full" />
                                {formatTime(duration)}
                            </span>
                        ) : (
                            <span>{bubbles.length > 0 ? `${bubbles.length} clips` : 'Ready'}</span>
                        )}
                    </div>

                    {/* Main Record Button */}
                    <Button
                        size="lg"
                        className={cn(
                            "h-16 w-16 rounded-full shadow-lg transition-all duration-300",
                            isRecording
                                ? "bg-red-500 hover:bg-red-600 scale-110"
                                : "bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-stone-200"
                        )}
                        onClick={isRecording ? stopRecording : startRecording}
                    >
                        {isRecording ? (
                            <Square className="w-6 h-6 fill-current text-white" />
                        ) : (
                            <Mic className="w-6 h-6 text-white dark:text-stone-900" />
                        )}
                    </Button>

                    {/* Finish / Send Button */}
                    <div className="w-20 flex justify-end">
                        <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "rounded-full transition-all duration-300",
                                bubbles.length > 0 ? "text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20" : "opacity-0 pointer-events-none"
                            )}
                            onClick={handleFinish}
                            disabled={isRecording || bubbles.length === 0 || isProcessing}
                        >
                            {isProcessing ? (
                                <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
