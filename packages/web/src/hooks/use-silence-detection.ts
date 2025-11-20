import { useState, useEffect, useRef, useCallback } from 'react'

interface UseSilenceDetectionProps {
    onSilence: (duration: number) => void
    threshold?: number // Silence threshold in ms
    enabled?: boolean
}

export function useSilenceDetection({
    onSilence,
    threshold = 5000,
    enabled = true
}: UseSilenceDetectionProps) {
    const [isSilent, setIsSilent] = useState(false)
    const lastActivityRef = useRef<number>(Date.now())
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const silenceStartRef = useRef<number | null>(null)

    const resetSilenceTimer = useCallback(() => {
        if (!enabled) return

        lastActivityRef.current = Date.now()
        setIsSilent(false)
        silenceStartRef.current = null

        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }

        timerRef.current = setTimeout(() => {
            setIsSilent(true)
            silenceStartRef.current = Date.now()
            onSilence(threshold)
        }, threshold)
    }, [enabled, threshold, onSilence])

    // Cleanup on unmount or disable
    useEffect(() => {
        if (!enabled) {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
            setIsSilent(false)
            return
        }

        resetSilenceTimer()

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
        }
    }, [enabled, resetSilenceTimer])

    return {
        isSilent,
        resetSilenceTimer
    }
}
