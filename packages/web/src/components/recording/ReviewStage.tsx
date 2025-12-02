'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarIcon, Wand2, Check } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { cn } from '@/lib/utils'

interface ReviewStageProps {
    audioUrl: string
    duration: number
    transcript?: string
    onSave: (data: { title: string, happenedAt: Date, isPublic: boolean }) => void
    onDiscard: () => void
    isProcessing?: boolean
}

export function ReviewStage({
    audioUrl,
    duration,
    transcript,
    onSave,
    onDiscard,
    isProcessing = false
}: ReviewStageProps) {
    const [title, setTitle] = useState('')
    const [happenedAt, setHappenedAt] = useState<Date | undefined>(new Date())
    const [isAutoLeveling, setIsAutoLeveling] = useState(true)

    const [isPublic, setIsPublic] = useState(false)

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
                        <Label className="text-stone-500">Preview</Label>
                        {isAutoLeveling && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
                                <Wand2 className="w-3 h-3" />
                                Auto-Leveling Applied
                            </div>
                        )}
                    </div>
                    {duration > 0 ? (
                        <AudioPlayer src={audioUrl} duration={duration} className="w-full" />
                    ) : (
                        <div className="p-4 text-center text-sm text-red-500 bg-red-50 rounded-lg border border-red-100">
                            Audio duration invalid. Please try recording again.
                        </div>
                    )}
                </div>

                {/* Date Picker (Timeline Anchor) */}
                <div className="space-y-2">
                    <Label>When did this happen?</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
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
                        This helps us place your story on the timeline.
                    </p>
                </div>

                {/* Title Input */}
                <div className="space-y-2">
                    <Label>Give it a title (optional)</Label>
                    <Input
                        placeholder="e.g., The Summer of '89"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-stone-50 dark:bg-stone-900"
                    />
                </div>

                {/* Visibility Toggle */}
                <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-100 dark:border-stone-800">
                    <div className="space-y-0.5">
                        <Label className="text-base font-medium">Visibility</Label>
                        <p className="text-sm text-stone-500 dark:text-stone-400">
                            {isPublic ? 'Public - Visible to everyone' : 'Private - Visible to project members'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-medium", !isPublic && "text-stone-900 dark:text-stone-100")}>Private</span>
                        <Switch
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
                <div className="flex gap-4 pt-4">
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
                        disabled={isProcessing || !happenedAt}
                    >
                        {isProcessing ? 'Saving...' : 'Save to Timeline'}
                    </Button>
                </div>
            </Card>
        </div>
    )
}
