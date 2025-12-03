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
    onClose: () => void
    className?: string
}

export function ResonanceCard({
    era,
    similarCount,
    onClose,
    className = ''
}: ResonanceCardProps) {
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

                {/* Footer Action */}
                <div className="flex justify-end">
                    <Button
                        onClick={onClose}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        Continue to Timeline
                    </Button>
                </div>
            </div>
        </Card>
    )
}
