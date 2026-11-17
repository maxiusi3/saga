import React from 'react';
import { Mic, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import type { InterventionLevel } from '@saga/shared/types/agents';
import { InterventionLevelSelector } from './InterventionLevelSelector';

interface RecorderHubProps {
    onModeSelect: (mode: 'deep_dive' | 'chat') => void;
    interventionLevel?: InterventionLevel;
    onInterventionLevelChange?: (level: InterventionLevel) => void;
    projectTitle?: string;
    promptText?: string;
    comfortTip?: string;
    facilitatorNote?: string;
    onSwitchPrompt?: () => void;
}

export function RecorderHub({
    onModeSelect,
    interventionLevel,
    onInterventionLevelChange,
    projectTitle = 'New Story',
    promptText,
    comfortTip,
    facilitatorNote,
    onSwitchPrompt,
}: RecorderHubProps) {
    const showInterventionSelector = interventionLevel && onInterventionLevelChange
    const topic = promptText || projectTitle
    const resolvedComfortTip = comfortTip || 'No need to prepare a speech—everyday details, ordinary moments, and approximate memories are more than enough.'
    const resolvedFacilitatorNote = facilitatorNote || 'Sitting together? You can read this question aloud and just chat over tea—there is no homework here.'

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-2 max-w-2xl">
                <h2 className="text-2xl font-serif font-medium text-stone-800 dark:text-stone-100">
                    Share one small memory, at your own pace
                </h2>
                <p className="text-stone-600 dark:text-stone-400">
                    Just talk like you would with family at the kitchen table. You can pause, skip, or change topics anytime.
                </p>
            </div>

            {/* Today's Gentle Topic Card */}
            <section
                aria-label="Today's gentle topic"
                className="w-full max-w-2xl rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm space-y-3 dark:border-amber-900/50 dark:bg-amber-950/20"
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                        Today&apos;s Gentle Topic
                    </span>
                    {onSwitchPrompt && (
                        <button
                            type="button"
                            onClick={onSwitchPrompt}
                            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-stone-900 dark:text-amber-200 dark:hover:bg-amber-950/60"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Try a lighter question
                        </button>
                    )}
                </div>
                <p className="text-lg font-medium text-stone-900 dark:text-stone-100 leading-relaxed">
                    {topic}
                </p>
                <div className="space-y-1.5 text-sm text-stone-600 dark:text-stone-300">
                    <p>{resolvedComfortTip}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{resolvedFacilitatorNote}</p>
                </div>
            </section>

            {showInterventionSelector && (
                <InterventionLevelSelector
                    value={interventionLevel}
                    onChange={onInterventionLevelChange}
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                {/* Chat Mode Card (Low-pressure starter) */}
                <button
                    type="button"
                    onClick={() => onModeSelect('chat')}
                    className="group relative flex flex-col items-center p-8 bg-white dark:bg-stone-900 rounded-2xl border-2 border-stone-200 dark:border-stone-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 hover:shadow-xl text-left"
                >
                    <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                        <MessageCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-2">
                        Quick Voice Chat
                    </h3>
                    <p className="text-sm text-stone-500 dark:text-stone-400 text-center">
                        Just 1–3 minutes—like leaving a warm voice message for family. Easy to start anytime.
                    </p>
                    <span className="absolute top-4 right-4 text-xs font-medium px-2 py-1 bg-blue-50 dark:bg-blue-950/40 rounded-full text-blue-700 dark:text-blue-300">
                        Easy start · 1-3 mins
                    </span>
                </button>

                {/* Deep Dive Mode Card */}
                <button
                    type="button"
                    onClick={() => onModeSelect('deep_dive')}
                    className="group relative flex flex-col items-center p-8 bg-white dark:bg-stone-900 rounded-2xl border-2 border-stone-200 dark:border-stone-800 hover:border-amber-500 dark:hover:border-amber-500 transition-all duration-300 hover:shadow-xl text-left"
                >
                    <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                        <Mic className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-2">
                        Relaxed Story Session
                    </h3>
                    <p className="text-sm text-stone-500 dark:text-stone-400 text-center">
                        Take your time with a fuller memory or a family conversation together. Pause whenever you want.
                    </p>
                    <span className="absolute top-4 right-4 text-xs font-medium px-2 py-1 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-500">
                        No rush · up to 30 mins
                    </span>
                </button>
            </div>

            {/* Psychological Safety Reassurance Card */}
            <div className="w-full max-w-2xl p-4 bg-stone-50 dark:bg-stone-900/50 rounded-xl border border-stone-200 dark:border-stone-800 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-sm text-stone-600 dark:text-stone-400">
                    Your stories stay private to your invited family by default. Mistakes, pauses, and uncertain dates are completely fine—your original voice is safely kept on this device first.
                </p>
            </div>
        </div>
    );
}
