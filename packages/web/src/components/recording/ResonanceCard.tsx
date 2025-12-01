'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Users, Globe, Lock, Heart } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ResonanceCardProps {
    era: string
    similarCount: number
    onOptIn: (optIn: boolean) => void
    className?: string
}

export function ResonanceCard({
    era,
    similarCount,
    onOptIn,
    className = ''
}: ResonanceCardProps) {
    // const t = useTranslations('resonance') // Assuming translations exist, using hardcoded for MVP
    const [isPublic, setIsPublic] = useState(false)

    const handleToggle = (checked: boolean) => {
        setIsPublic(checked)
        onOptIn(checked)
    }

    return (
        <Card className={`p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100 ${className}`}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white rounded-full shadow-sm">
                        <Users className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-indigo-900">
                            You are not alone.
                        </h3>
                        <p className="text-indigo-700 mt-1">
                            Your story about <span className="font-bold">{era}</span> resonates with <span className="font-bold">{similarCount.toLocaleString()}</span> other people.
                        </p>
                    </div>
                </div>

                {/* Visualization (Mock Heatmap/Cloud) */}
                <div className="h-24 bg-white/50 rounded-lg flex items-center justify-center border border-indigo-100/50">
                    <div className="flex gap-2 items-end h-16">
                        {[40, 70, 45, 90, 60, 80, 50].map((h, i) => (
                            <div
                                key={i}
                                className="w-3 bg-indigo-400 rounded-t-sm opacity-80"
                                style={{ height: `${h}%` }}
                            />
                        ))}
                    </div>
                    <span className="ml-4 text-xs text-indigo-400 font-medium">Resonance Wave</span>
                </div>

                {/* Opt-In Section */}
                <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            {isPublic ? (
                                <Globe className="w-4 h-4 text-indigo-600" />
                            ) : (
                                <Lock className="w-4 h-4 text-slate-500" />
                            )}
                            <span className="font-semibold text-slate-900">
                                {isPublic ? 'Contribute to History' : 'Keep Private'}
                            </span>
                        </div>
                        <Switch
                            checked={isPublic}
                            onCheckedChange={handleToggle}
                        />
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed">
                        {isPublic
                            ? "Your story will be anonymized and added to the Collective Memory Bank, helping future generations understand this era."
                            : "Your story is currently private. Turn this on to anonymously share your experience with the world."
                        }
                    </p>
                </div>

                {/* Footer */}
                {isPublic && (
                    <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 p-2 rounded justify-center">
                        <Heart className="w-3 h-3 fill-current" />
                        <span>Thank you for preserving history.</span>
                    </div>
                )}
            </div>
        </Card>
    )
}
