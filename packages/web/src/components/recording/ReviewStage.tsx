'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { useTranslations } from 'next-intl'
import type { RecordingSaveMetadata } from '@/lib/recording-save-contract'
import { cn } from '@/lib/utils'

export type DraftStatus = 'idle' | 'processing' | 'ready' | 'failed'

interface ReviewStageProps {
    audioUrl: string
    duration: number
    transcript?: string
    aiSummary?: string
    onSave: (data: { title: string, happenedAt: Date, isPublic: boolean }) => void
    onDiscard: () => void
    isProcessing?: boolean
    draftStatus?: DraftStatus
    saveMetadata?: RecordingSaveMetadata | null
    saved?: boolean
    retrySave?: boolean
    recovered?: boolean
}

const DECADE_PRESETS = [
    { label: '1950s', year: 1955 },
    { label: '1960s', year: 1965 },
    { label: '1970s', year: 1975 },
    { label: '1980s', year: 1985 },
    { label: '1990s', year: 1995 },
    { label: '2000s', year: 2005 },
] as const

export function ReviewStage({
    audioUrl,
    duration,
    transcript,
    aiSummary,
    onSave,
    onDiscard,
    isProcessing = false,
    draftStatus = 'idle',
    saveMetadata, saved = false, retrySave = false, recovered = false
}: ReviewStageProps) {
    const t = useTranslations('recording.saveFlow')
    const recovery = useTranslations('recording.recovery')
    const [title, setTitle] = useState('')
    const [happenedAt, setHappenedAt] = useState<Date | undefined>(new Date())

    const [isPublic, setIsPublic] = useState(false)
    useEffect(() => {
        if (saveMetadata) { setTitle(saveMetadata.title); setHappenedAt(new Date(saveMetadata.happenedAt)); setIsPublic(saveMetadata.isPublic) }
    },[saveMetadata])
    const locked = isProcessing || !!saveMetadata || saved

    const handleSave = () => {
        if (!happenedAt) return
        onSave({
            title: title || `Story from ${format(happenedAt, 'MMMM yyyy')}`,
            happenedAt,
            isPublic
        })
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-serif font-medium text-stone-800 dark:text-stone-100">
                    Review & Polish
                </h2>
                <p className="text-stone-500 dark:text-stone-400">
                    Add a date to anchor this memory in time.
                </p>
            </div>

            <Card className="p-6 space-y-6 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800">
                {/* Audio Preview */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-stone-500">Original recording</Label>
                    </div>
                    {duration > 0 ? (
                        <AudioPlayer src={audioUrl} duration={duration} className="w-full" />
                    ) : (
                        <audio controls src={audioUrl} preload="metadata" aria-label="Original recording" className="w-full" />
                    )}
                    <a href={audioUrl} download="saga-local-recording" className="text-sm underline underline-offset-4">{t('download')}</a>
                    {recovered && !saved && <p className="text-sm text-stone-600 dark:text-stone-400">{recovery('notice')}</p>}
                </div>

                <p
                    role={draftStatus === 'failed' ? 'alert' : 'status'}
                    className="text-sm text-stone-600 dark:text-stone-400"
                >
                    {draftStatus === 'processing' && 'Preparing a draft. You can save the recording now.'}
                    {draftStatus === 'failed' && 'A draft could not be prepared. You can still save the recording and any available transcript.'}
                    {draftStatus === 'ready' && 'Draft prepared. Review the recording before saving.'}
                    {draftStatus === 'idle' && 'No transcript is available, so a draft cannot be prepared. You can still save the recording.'}
                </p>

                {draftStatus === 'ready' && aiSummary && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 space-y-1.5 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-300">
                            Listener&apos;s Note · Why This Memory Matters
                        </p>
                        <p className="text-sm leading-relaxed text-stone-800 dark:text-stone-200">
                            {aiSummary}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                            Your original voice recording is preserved untouched alongside this draft.
                        </p>
                    </div>
                )}

                {/* Date Picker (Timeline Anchor) */}
                <div className="space-y-3">
                    <Label>When did this happen?</Label>
                    <div className="flex flex-wrap gap-2">
                        {DECADE_PRESETS.map((preset) => (
                            <Button
                                key={preset.label}
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={locked}
                                onClick={() => setHappenedAt(new Date(Date.UTC(preset.year, 0, 1)))}
                                className="h-auto px-2.5 py-1 text-xs"
                            >
                                {preset.label}
                            </Button>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={locked}
                            onClick={() => setHappenedAt(new Date())}
                            className="h-auto px-2.5 py-1 text-xs"
                        >
                            Not sure (keep today&apos;s date for now)
                        </Button>
                    </div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                disabled={locked}
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !happenedAt && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {happenedAt ? format(happenedAt, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={happenedAt}
                                onSelect={setHappenedAt}
                                initialFocus
                                disabled={(date: Date) => date > new Date() || date < new Date("1900-01-01")}
                            />
                        </PopoverContent>
                    </Popover>
                    <p className="text-xs text-stone-500">
                        Approximate eras or rough years are completely fine—your family can always refine this later.
                    </p>
                </div>

                {/* Title Input */}
                <div className="space-y-2">
                    <Label htmlFor="recording-story-title">Give it a title (optional)</Label>
                    <Input
                        id="recording-story-title"
                        disabled={locked}
                        placeholder="e.g., The Summer of '89"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-stone-50 dark:bg-stone-900"
                    />
                </div>

                {/* Visibility Toggle */}
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between p-4 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-100 dark:border-stone-800">
                    <div className="min-w-0 space-y-1">
                        <Label className="text-base font-medium">Visibility</Label>
                        <p className="text-sm text-stone-500 dark:text-stone-400">
                            {isPublic ? 'Public - Visible to everyone' : 'Private - Visible to project members'}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                            Nothing is shared outside your invited family circle unless you explicitly choose Public.
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <span className={cn("text-xs font-medium", !isPublic && "text-stone-900 dark:text-stone-100")}>Private</span>
                        <Switch
                            aria-label="Story visibility"
                            disabled={locked}
                            checked={isPublic}
                            onCheckedChange={setIsPublic}
                        />
                        <span className={cn("text-xs font-medium", isPublic && "text-stone-900 dark:text-stone-100")}>Public</span>
                    </div>
                </div>

                {/* Transcript Preview (Collapsed) */}
                {transcript && (
                    <div className="pt-4 border-t border-stone-100 dark:border-stone-800">
                        <Label className="mb-2 block text-stone-500">Transcript Preview</Label>
                        <p className="text-sm text-stone-600 dark:text-stone-400 line-clamp-3 italic">
                            "{transcript}"
                        </p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:gap-4">
                    <Button
                        variant="outline"
                        onClick={onDiscard}
                        className="flex-1"
                        disabled={isProcessing}
                    >
                        Discard
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="flex-1 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200"
                        disabled={isProcessing || saved || !happenedAt}
                    >
                        {isProcessing ? t('saving') : saved ? t('savedAction') : retrySave || saveMetadata ? t('continueSaving') : 'Save to Timeline'}
                    </Button>
                </div>
            </Card>
        </div>
    )
}
