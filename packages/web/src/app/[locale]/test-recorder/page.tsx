'use client'

import { useState } from 'react'
import { RecorderHub } from '@/components/recording/RecorderHub'
import { DeepDiveRecorder } from '@/components/recording/DeepDiveRecorder'
import { ChatRecorder } from '@/components/recording/ChatRecorder'
import { ReviewStage } from '@/components/recording/ReviewStage'
import { ResonanceCard } from '@/components/recording/ResonanceCard'

export default function TestRecorderPage() {
    const [stage, setStage] = useState<'hub' | 'recording' | 'review'>('hub')
    const [mode, setMode] = useState<'deep_dive' | 'chat'>('deep_dive')
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [duration, setDuration] = useState(0)
    const [showResonance, setShowResonance] = useState(false)

    const handleModeSelect = (m: 'deep_dive' | 'chat') => {
        setMode(m)
        setStage('recording')
    }

    const handleRecordingComplete = (result: any) => {
        if (result.audioBlob) {
            setAudioUrl(URL.createObjectURL(result.audioBlob))
        }
        setDuration(result.duration)
        setStage('review')
    }

    const handleSave = () => {
        setShowResonance(true)
    }

    return (
        <div className="min-h-screen bg-stone-50 p-8">
            <h1 className="text-2xl font-bold mb-8 text-center">V1.8 Recorder Verification</h1>

            {stage === 'hub' && !showResonance && (
                <RecorderHub onModeSelect={handleModeSelect} />
            )}

            {stage === 'recording' && (
                <div className="max-w-4xl mx-auto">
                    <button onClick={() => setStage('hub')} className="mb-4">Back</button>
                    {mode === 'deep_dive' ? (
                        <DeepDiveRecorder
                            onRecordingComplete={handleRecordingComplete}
                            promptText="Tell me about your childhood home."
                        />
                    ) : (
                        <ChatRecorder
                            onRecordingComplete={handleRecordingComplete}
                        />
                    )}
                </div>
            )}

            {stage === 'review' && audioUrl && !showResonance && (
                <ReviewStage
                    audioUrl={audioUrl}
                    duration={duration}
                    onSave={handleSave}
                    onDiscard={() => setStage('hub')}
                />
            )}

            {showResonance && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
                    <ResonanceCard
                        era="1980s"
                        similarCount={123}
                        onOptIn={() => alert('Opted in!')}
                    />
                </div>
            )}
        </div>
    )
}
