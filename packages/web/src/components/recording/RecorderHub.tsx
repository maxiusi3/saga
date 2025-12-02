import React from 'react';
import { Mic, MessageCircle } from 'lucide-react';

interface RecorderHubProps {
    onModeSelect: (mode: 'deep_dive' | 'chat') => void;
    projectTitle?: string;
}

export function RecorderHub({ onModeSelect, projectTitle = 'New Story' }: RecorderHubProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-serif font-medium text-stone-800 dark:text-stone-100">
                    How would you like to tell this story?
                </h2>
                <p className="text-stone-500 dark:text-stone-400">
                    Choose the format that fits your memory.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                {/* Deep Dive Mode Card */}
                <button
                    onClick={() => onModeSelect('deep_dive')}
                    className="group relative flex flex-col items-center p-8 bg-white dark:bg-stone-900 rounded-2xl border-2 border-stone-200 dark:border-stone-800 hover:border-amber-500 dark:hover:border-amber-500 transition-all duration-300 hover:shadow-xl text-left"
                >
                    <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                        <Mic className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-2">
                        Deep Dive
                    </h3>
                    <p className="text-sm text-stone-500 dark:text-stone-400 text-center">
                        Best for long, detailed stories. We'll guide you with questions if you get stuck.
                    </p>
                    <span className="absolute top-4 right-4 text-xs font-medium px-2 py-1 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-500">
                        10-30 mins
                    </span>
                </button>

                {/* Chat Mode Card */}
                <button
                    onClick={() => onModeSelect('chat')}
                    className="group relative flex flex-col items-center p-8 bg-white dark:bg-stone-900 rounded-2xl border-2 border-stone-200 dark:border-stone-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 hover:shadow-xl text-left"
                >
                    <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                        <MessageCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-2">
                        Chat Bubbles
                    </h3>
                    <p className="text-sm text-stone-500 dark:text-stone-400 text-center">
                        Share quick anecdotes or thoughts, one bubble at a time. Like sending a voice note.
                    </p>
                    <span className="absolute top-4 right-4 text-xs font-medium px-2 py-1 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-500">
                        1-2 mins
                    </span>
                </button>
            </div>

            {/* AI Prompt Card (Passive) */}
            <div className="w-full max-w-md p-4 bg-stone-50 dark:bg-stone-900/50 rounded-xl border border-stone-200 dark:border-stone-800 text-center">
                <p className="text-sm text-stone-500 dark:text-stone-400 italic">
                    "Not sure where to start? Pick a mode, and I'll help you find the words."
                </p>
            </div>
        </div>
    );
}
