'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'react-hot-toast'
import { StoryPrompt, getAlternateGentlePrompt, getNextPrompt } from '@saga/shared'
import type { InterventionLevel } from '@saga/shared/types/agents'
import { RecorderHub } from '@/components/recording/RecorderHub'
import { SmartRecorder } from '@/components/recording/SmartRecorder'
import { RecordingRecoveryPanel, type RecoveredRecording } from '@/components/recording/RecordingRecoveryPanel'
import { ReviewStage, type DraftStatus } from '@/components/recording/ReviewStage'
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
import { saveLocalRecording, clearSavedLocalRecording, type RecordingSaveProgress } from '@/lib/recording-save-flow'
import type { RecordingSaveMetadata, RecordingSaveReceipt } from '@/lib/recording-save-contract'

type RecordingMode = 'deep_dive' | 'chat'
type Stage = 'hub' | 'recording' | 'review' | 'textFallback' | 'submission'

export default function ProjectRecordPage() {
  const params = useParams()
  const { user } = useAuthStore()
  return <ScopedProjectRecordPage key={JSON.stringify([params.id,user?.id])} />
}

function ScopedProjectRecordPage() {
  const t = useTranslations('recording')
  const tf = useTranslations('recording.saveFlow')
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
  const [recoveredDraft, setRecoveredDraft] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [textStoryTitle, setTextStoryTitle] = useState('')
  const [textStoryContent, setTextStoryContent] = useState('')
  const [recorderError, setRecorderError] = useState<string | null>(null)

  // AI State
  const [aiContent, setAiContent] = useState<AIContentType | null>(null)
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle')
  const aiRequestVersionRef = useRef(0)

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResonance, setShowResonance] = useState(false)
  const [localSessionId,setLocalSessionId] = useState<string|null>(null)
  const [saveMetadata,setSaveMetadata] = useState<RecordingSaveMetadata|null>(null)
  const [saveProgress,setSaveProgress] = useState<RecordingSaveProgress|null>(null)
  const [savePending,setSavePending] = useState(false)
  const [saveError,setSaveError] = useState<string|null>(null)
  const [saveReceipt,setSaveReceipt] = useState<RecordingSaveReceipt|null>(null)
  const [localCleared,setLocalCleared] = useState(false)
  const saveOperationRef = useRef<AbortController|null>(null)
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
    aiRequestVersionRef.current += 1
    saveOperationRef.current?.abort()
  }, [])

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  const resetRecording = () => {
    saveOperationRef.current?.abort()
    saveOperationRef.current=null
    setIsSubmitting(false)
    setLocalSessionId(null)
    setSaveMetadata(null)
    setSaveProgress(null)
    setSavePending(false)
    setSaveError(null)
    setSaveReceipt(null)
    setLocalCleared(false)
    aiRequestVersionRef.current += 1
    setAiContent(null)
    setDraftStatus('idle')
    setTranscript('')
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingDuration(0)
    setRecoveredDraft(false)
    setSavedStoryId(null)
  }

  const handleReturnToHub = () => {
    resetRecording()
    interviewSessionRequestVersionRef.current += 1
    setInterviewSessionId(null)
    setRecorderError(null)
    setStage('hub')
  }

  const handleModeSelect = (selectedMode: RecordingMode) => {
    resetRecording()
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

  const handleRecordingComplete = async (result: { sessionId?: string, audioBlob?: Blob, transcript?: string, duration: number }) => {
    const requestVersion = ++aiRequestVersionRef.current
    setAiContent(null)
    setDraftStatus('idle')
    setLocalSessionId(result.sessionId ?? null)
    setAudioBlob(result.audioBlob ?? null)
    setAudioUrl(result.audioBlob ? URL.createObjectURL(result.audioBlob) : null)
    setRecordingDuration(result.duration)
    setTranscript(result.transcript ?? '')

    setStage('review')

    // Browser captions are provisional; durable server transcription is a later workflow.
    // This draft must never gate saving the original recording.
    if (result.transcript?.trim()) {
      setDraftStatus('processing')
      try {
        const generated = await aiService.generateContentFromTranscript(result.transcript, currentPrompt?.text, locale)
        if (aiRequestVersionRef.current === requestVersion) {
          setAiContent(generated)
          setDraftStatus('ready')
        }
      } catch (e) {
        if (aiRequestVersionRef.current === requestVersion) {
          console.error('AI processing error', e)
          setDraftStatus('failed')
        }
      }
    }
  }

  const handleRecoveredRecording = (recording: RecoveredRecording) => {
    resetRecording()
    setRecoveredDraft(true)
    const metadata=recording.session.saveIntent?.metadata
    setLocalSessionId(recording.session.id)
    setAudioBlob(recording.blob)
    setAudioUrl(URL.createObjectURL(recording.blob))
    setTranscript(metadata?.transcript ?? '')
    setMode(metadata?.recordingMode ?? 'chat')
    setSaveMetadata(metadata ?? null)
    setStage('review')
  }

  const saveOptions = (controller: AbortController) => ({
    identity:{actorId:user!.id,projectId,sessionId:localSessionId!}, signal:controller.signal,
    isCurrent:()=>saveOperationRef.current === controller && !controller.signal.aborted,
    onProgress:setSaveProgress, onIntent:setSaveMetadata,
  })
  const handleSaveStory = async (data: { title: string, happenedAt: Date, isPublic: boolean }) => {
    if (!audioBlob || !user?.id || saveOperationRef.current || saveReceipt) return
    if (!localSessionId) { setSaveError('unavailable'); return }
    const controller=new AbortController()
    saveOperationRef.current=controller
    const options=saveOptions(controller)
    setIsSubmitting(true)
    setSaveError(null)
    setSavePending(false)
    try {
      const result=await saveLocalRecording({...options,metadata:saveMetadata ?? {
        title:data.title,content:aiContent?.summary ?? '',transcript,happenedAt:data.happenedAt.toISOString(),recordingMode:mode,isPublic:data.isPublic,
      }})
      if (!options.isCurrent()) return
      if (result.state === 'pending') setSavePending(true)
      else { setSaveReceipt(result.receipt); setSavedStoryId(result.receipt.storyId) }
    } catch (error) {
      if (options.isCurrent()) setSaveError(error instanceof Error && error.message === 'recording_lock_unavailable' ? 'unsupported' :
        error instanceof Error && error.message === 'recording_busy' ? 'busy' : 'unavailable')
    } finally {
      if (options.isCurrent()) { saveOperationRef.current=null; setIsSubmitting(false) }
    }
  }
  const handleClearLocal = async () => {
    if (!saveReceipt || !localSessionId || !user?.id || saveOperationRef.current) return
    const controller=new AbortController()
    saveOperationRef.current=controller
    const options=saveOptions(controller)
    setIsSubmitting(true)
    setSaveError(null)
    try {
      await clearSavedLocalRecording(options,saveReceipt)
      if (options.isCurrent()) setLocalCleared(true)
    } catch { if (options.isCurrent()) setSaveError('cleanupError') }
    finally { if (options.isCurrent()) { saveOperationRef.current=null; setIsSubmitting(false) } }
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
          <div className="space-y-6">
            <RecordingRecoveryPanel projectId={projectId} userId={user?.id} onContinue={handleRecoveredRecording} />
            <RecorderHub
              onModeSelect={handleModeSelect}
              interventionLevel={interventionLevel}
              onInterventionLevelChange={setInterventionLevel}
              projectTitle={currentPrompt.text}
              promptText={currentPrompt.text}
              comfortTip={currentPrompt.comfortTip}
              facilitatorNote={currentPrompt.facilitatorNote}
              onSwitchPrompt={() => setCurrentPrompt(prev => getAlternateGentlePrompt(prev?.id))}
            />
          </div>
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
                sessionId: res.sessionId,
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
          <div className="space-y-6">
          <ReviewStage
            key={localSessionId}
            audioUrl={audioUrl}
            duration={recordingDuration}
            recovered={recoveredDraft}
            transcript={transcript}
            aiSummary={aiContent?.summary}
            onSave={handleSaveStory}
            onDiscard={handleReturnToHub}
            isProcessing={isSubmitting}
            draftStatus={draftStatus}
            saveMetadata={saveMetadata}
            saved={!!saveReceipt}
            retrySave={savePending || !!saveError}
          />
          {(saveProgress || saveError || saveReceipt) && <Card className="max-w-2xl mx-auto p-6 space-y-4">
            {saveError ? <p role="alert">{tf(saveError)}</p> : <p role="status">{tf(localCleared ? 'cleared' : saveReceipt ? 'saved' : savePending ? 'pending' : saveProgress ?? 'checking')}</p>}
            {saveReceipt && <>
              <a className="font-medium underline underline-offset-4" href={withLocale(`/dashboard/projects/${projectId}/stories/${saveReceipt.storyId}`)}>{tf('openStory')}</a>
              <audio controls preload="none" src={saveReceipt.playbackUrl} aria-label={tf('playback')} className="w-full" onError={()=>setSaveError('playbackError')} />
              {!localCleared && <Button type="button" variant="outline" disabled={isSubmitting} onClick={()=>void handleClearLocal()}>{tf('clearLocal')}</Button>}
            </>}
          </Card>}
          </div>
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
