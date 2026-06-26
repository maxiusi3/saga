'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'react-hot-toast'
import { StoryPrompt, getNextPrompt } from '@saga/shared'
import type { InterventionLevel } from '@saga/shared/types/agents'
import { RecorderHub } from '@/components/recording/RecorderHub'
import { SmartRecorder } from '@/components/recording/SmartRecorder'
import { ReviewStage } from '@/components/recording/ReviewStage'
import { ResonanceCard } from '@/components/recording/ResonanceCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { storyService } from '@/lib/stories'
import { useAuthStore } from '@/stores/auth-store'
import { aiService, AIContent as AIContentType } from '@/lib/ai-service'
import { agentService } from '@/lib/agent-service'
import { uploadStoryAudio } from '@/lib/storage'

type RecordingMode = 'deep_dive' | 'chat'
type Stage = 'hub' | 'recording' | 'review' | 'textFallback' | 'submission'

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
  const [interventionLevel, setInterventionLevel] = useState<InterventionLevel>('low')
  const [interviewSessionId, setInterviewSessionId] = useState<string | null>(null)
  const interviewSessionRequestVersionRef = useRef(0)

  // Data State
  const [currentPrompt, setCurrentPrompt] = useState<StoryPrompt | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [textStoryTitle, setTextStoryTitle] = useState('')
  const [textStoryContent, setTextStoryContent] = useState('')
  const [recorderError, setRecorderError] = useState<string | null>(null)

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

  useEffect(() => () => {
    interviewSessionRequestVersionRef.current += 1
  }, [])

  const handleReturnToHub = () => {
    interviewSessionRequestVersionRef.current += 1
    setInterviewSessionId(null)
    setRecorderError(null)
    setStage('hub')
  }

  const handleModeSelect = (selectedMode: RecordingMode) => {
    const requestVersion = interviewSessionRequestVersionRef.current + 1
    interviewSessionRequestVersionRef.current = requestVersion

    setMode(selectedMode)
    setInterviewSessionId(null)
    setStage('recording')

    if (user?.id) {
      void agentService.createInterviewSession({
        projectId,
        storytellerId: user.id,
        promptText: currentPrompt?.text,
        recordingMode: selectedMode,
        interventionLevel,
      })
        .then(session => {
          if (interviewSessionRequestVersionRef.current === requestVersion) {
            setInterviewSessionId(session.id)
          }
        })
        .catch(error => {
          if (interviewSessionRequestVersionRef.current !== requestVersion) return
          console.warn('[record/page] failed to create interview session:', error)
        })
    } else {
      console.warn('[record/page] cannot create interview session without storyteller id')
    }
  }

  const shouldOfferTextFallback = (message: string) => {
    const normalized = message.toLowerCase()
    return normalized.includes('permission') ||
      normalized.includes('denied') ||
      normalized.includes('notallowed') ||
      normalized.includes('not allowed')
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
      void agentService.processStoryWithEditorAgent({ storyId: story.id }).catch(error => {
        console.warn('[record/page] editor agent processing failed:', error)
      })

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

  const handleSaveTextStory = async () => {
    const content = textStoryContent.trim()
    if (!content || !user?.id) return

    setIsSubmitting(true)
    try {
      const title = textStoryTitle.trim() || `Story from ${new Date().toLocaleDateString(locale)}`
      const story = await storyService.createStory({
        project_id: projectId,
        storyteller_id: user.id,
        title,
        content,
        transcript: content,
        audio_duration: 0,
        happened_at: new Date(),
        recording_mode: 'chat',
        is_public: false
      })

      if (!story) throw new Error('Failed to create story')

      setSavedStoryId(story.id)
      void agentService.processStoryWithEditorAgent({ storyId: story.id }).catch(error => {
        console.warn('[record/page] editor agent processing failed:', error)
      })
      toast.success('Story saved to timeline!')
      router.push(withLocale(`/dashboard/projects/${projectId}/stories/${story.id}`))
    } catch (error) {
      console.error('Text story save failed:', error)
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
            onClick={handleReturnToHub}
            className="mb-6 text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-2"
          >
            ← Back to Mode Selection
          </button>
        )}

        {/* Stage: HUB */}
        {stage === 'hub' && (
          <RecorderHub
            onModeSelect={handleModeSelect}
            interventionLevel={interventionLevel}
            onInterventionLevelChange={setInterventionLevel}
            projectTitle={currentPrompt.text}
          />
        )}

        {/* Stage: RECORDING */}
        {stage === 'recording' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <SmartRecorder
              projectId={projectId}
              storytellerId={user?.id || ''}
              interviewSessionId={interviewSessionId}
              interventionLevel={interventionLevel}
              promptText={currentPrompt.text}
              locale={locale}
              maxDuration={30 * 60}
              onRecordingComplete={(res) => handleRecordingComplete({
                audioBlob: res.audioBlob,
                transcript: res.transcript,
                duration: res.duration
              })}
              onError={(message) => {
                setRecorderError(message)
                if (shouldOfferTextFallback(message)) {
                  setStage('textFallback')
                  return
                }
                console.error('[record/page] recorder error:', message)
              }}
            />
          </div>
        )}

        {stage === 'textFallback' && (
          <Card className="max-w-2xl mx-auto p-6 space-y-6 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800">
            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-medium text-stone-800 dark:text-stone-100">
                Write this story instead
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {recorderError ? `Recording could not start: ${recorderError}` : 'Recording could not start in this browser.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="text-story-title">Title</Label>
              <Input
                id="text-story-title"
                value={textStoryTitle}
                onChange={(event) => setTextStoryTitle(event.target.value)}
                placeholder="e.g., Smoke test typed story"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="text-story-content">Story text</Label>
              <Textarea
                id="text-story-content"
                value={textStoryContent}
                onChange={(event) => setTextStoryContent(event.target.value)}
                placeholder="Type the story here."
                className="min-h-40"
              />
            </div>

            <div className="flex gap-4 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleReturnToHub}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleSaveTextStory}
                disabled={isSubmitting || textStoryContent.trim().length === 0}
              >
                {isSubmitting ? 'Saving...' : 'Save text story'}
              </Button>
            </div>
          </Card>
        )}

        {/* Stage: REVIEW */}
        {stage === 'review' && audioUrl && (
          <ReviewStage
            audioUrl={audioUrl}
            duration={recordingDuration}
            transcript={transcript}
            onSave={handleSaveStory}
            onDiscard={handleReturnToHub}
            isProcessing={isSubmitting}
          />
        )}

        {/* Resonance Overlay */}
        {showResonance && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-500">
            <ResonanceCard
              era={resonanceData.era}
              similarCount={resonanceData.count}
              onClose={() => router.push(withLocale(`/dashboard/projects/${projectId}`))}
              className="max-w-md w-full shadow-2xl border-stone-800"
            />
          </div>
        )}
      </div>
    </div>
  )
}
