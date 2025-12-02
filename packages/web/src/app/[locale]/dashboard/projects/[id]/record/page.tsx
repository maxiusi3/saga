'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'react-hot-toast'
import { StoryPrompt, getNextPrompt } from '@saga/shared'
import { RecorderHub } from '@/components/recording/RecorderHub'
import { DeepDiveRecorder } from '@/components/recording/DeepDiveRecorder'
import { ChatRecorder } from '@/components/recording/ChatRecorder'
import { ReviewStage } from '@/components/recording/ReviewStage'
import { ResonanceCard } from '@/components/recording/ResonanceCard'
import { storyService } from '@/lib/stories'
import { useAuthStore } from '@/stores/auth-store'
import { aiService, AIContent as AIContentType } from '@/lib/ai-service'
import { uploadStoryAudio, StorageService } from '@/lib/storage'

type RecordingMode = 'deep_dive' | 'chat'
type Stage = 'hub' | 'recording' | 'review' | 'submission'

export default function ProjectRecordPage() {
  const t = useTranslations('recording')
  const ts = useTranslations('stories')
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const { user } = useAuthStore()
  const projectId = params.id as string

  // Flow State
  const [stage, setStage] = useState<Stage>('hub')
  const [mode, setMode] = useState<RecordingMode>('deep_dive')

  // Data State
  const [currentPrompt, setCurrentPrompt] = useState<StoryPrompt | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [transcript, setTranscript] = useState('')

  // AI State
  const [aiContent, setAiContent] = useState<AIContentType | null>(null)
  const [isAiProcessing, setIsAiProcessing] = useState(false)

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResonance, setShowResonance] = useState(false)
  const [savedStoryId, setSavedStoryId] = useState<string | null>(null)
  const [resonanceData, setResonanceData] = useState({ era: '1980s', count: 0 })

  const withLocale = (path: string) => {
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }

  useEffect(() => {
    // Load prompt
    const prompt = getNextPrompt()
    setCurrentPrompt(prompt)
  }, [])

  const handleModeSelect = (selectedMode: RecordingMode) => {
    setMode(selectedMode)
    setStage('recording')
  }

  const handleRecordingComplete = async (result: { audioBlob?: Blob, transcript?: string, duration: number }) => {
    if (result.audioBlob) {
      setAudioBlob(result.audioBlob)
      setAudioUrl(URL.createObjectURL(result.audioBlob))
    }
    setRecordingDuration(result.duration)
    if (result.transcript) setTranscript(result.transcript)

    setStage('review')

    // Start background AI processing
    if (result.transcript || result.audioBlob) {
      setIsAiProcessing(true)
      try {
        // Mock AI processing for now or use real service if available
        // In a real scenario, we'd fire this off and update aiContent when done
        if (result.transcript) {
          // We can use the existing API call here if needed
          // For now, we'll simulate a quick analysis for the "Review" stage title suggestion
          const generated = await aiService.generateContentFromTranscript(result.transcript, currentPrompt?.text, locale)
          setAiContent(generated)
        }
      } catch (e) {
        console.error('AI processing error', e)
      } finally {
        setIsAiProcessing(false)
      }
    }
  }

  const handleSaveStory = async (data: { title: string, happenedAt: Date, isPublic: boolean }) => {
    if (!audioBlob || !user?.id) return

    setIsSubmitting(true)
    try {
      // 1. Upload Audio
      let uploadedAudioUrl = null
      const uploadRes = await uploadStoryAudio(audioBlob, projectId)
      if (uploadRes.success) {
        uploadedAudioUrl = uploadRes.url
      } else {
        throw new Error('Audio upload failed')
      }

      // 2. Create Story
      const storyData = {
        project_id: projectId,
        storyteller_id: user.id,
        title: data.title,
        content: aiContent?.summary || '',
        audio_url: uploadedAudioUrl,
        audio_duration: recordingDuration,
        transcript: transcript,
        happened_at: data.happenedAt,
        recording_mode: mode,
        ai_generated_title: aiContent?.title,
        ai_summary: aiContent?.summary,
        ai_confidence_score: aiContent?.confidence,
        is_public: data.isPublic
      }

      const story = await storyService.createStory(storyData)
      if (!story) throw new Error('Failed to create story')

      setSavedStoryId(story.id)

      // 3. Show Resonance
      const era = data.happenedAt.getFullYear().toString().slice(0, 3) + '0s'
      setResonanceData({
        era,
        count: Math.floor(Math.random() * 500) + 50 // Mock count
      })
      setShowResonance(true)
      toast.success('Story saved to timeline!')

    } catch (error) {
      console.error('Save failed:', error)
      toast.error('Failed to save story')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOptIn = async (optIn: boolean) => {
    if (optIn && savedStoryId) {
      try {
        await storyService.updateStory(savedStoryId, { is_public: true })
        toast.success('Added to Collective Memory')
      } catch (e) {
        console.error(e)
      }
    }

    setTimeout(() => {
      router.push(withLocale(`/dashboard/projects/${projectId}`))
    }, 1000)
  }

  if (!currentPrompt) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header (Back button, etc) */}
        {stage !== 'hub' && !showResonance && (
          <button
            onClick={() => setStage('hub')}
            className="mb-6 text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-2"
          >
            ← Back to Mode Selection
          </button>
        )}

        {/* Stage: HUB */}
        {stage === 'hub' && (
          <RecorderHub
            onModeSelect={handleModeSelect}
            projectTitle={currentPrompt.text}
          />
        )}

        {/* Stage: RECORDING */}
        {stage === 'recording' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            {mode === 'deep_dive' ? (
              <DeepDiveRecorder
                onRecordingComplete={(res) => handleRecordingComplete({
                  audioBlob: res.audioBlob,
                  transcript: res.transcript,
                  duration: res.duration
                })}
                promptText={currentPrompt.text}
                locale={locale}
              />
            ) : (
              <div className="max-w-md mx-auto space-y-8">
                <div className="text-center">
                  <h2 className="text-xl font-medium text-stone-800 dark:text-stone-100">Chat Mode</h2>
                  <p className="text-stone-500">Share a quick thought.</p>
                </div>
                <ChatRecorder
                  onRecordingComplete={(res) => handleRecordingComplete({
                    audioBlob: res.audioBlob,
                    duration: res.duration
                  })}
                />
              </div>
            )}
          </div>
        )}

        {/* Stage: REVIEW */}
        {stage === 'review' && audioUrl && (
          <ReviewStage
            audioUrl={audioUrl}
            duration={recordingDuration}
            transcript={transcript}
            onSave={handleSaveStory}
            onDiscard={() => setStage('hub')}
            isProcessing={isSubmitting}
          />
        )}

        {/* Resonance Overlay */}
        {showResonance && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-500">
            <ResonanceCard
              era={resonanceData.era}
              similarCount={resonanceData.count}
              onOptIn={handleOptIn}
              className="max-w-md w-full shadow-2xl border-stone-800"
            />
          </div>
        )}
      </div>
    </div>
  )
}
