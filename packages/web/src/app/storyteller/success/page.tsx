'use client'

import { useEffect, useState } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { CheckCircle, Mic, Home } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SuccessPage() {
  const [showConfetti, setShowConfetti] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Show success animation
    setShowConfetti(true)
    const timer = setTimeout(() => setShowConfetti(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center space-y-8 py-16">
        {/* Success Icon with Animation */}
        <div className="relative">
          <div className={`transition-all duration-1000 ${showConfetti ? 'scale-110' : 'scale-100'}`}>
            <div className="w-24 h-24 bg-furbridge-teal/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-furbridge-teal" />
            </div>
          </div>
          
          {/* Confetti Effect */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="animate-bounce text-2xl absolute -top-4 -left-4">🎉</div>
              <div className="animate-bounce text-2xl absolute -top-2 -right-6 animation-delay-200">✨</div>
              <div className="animate-bounce text-2xl absolute -bottom-2 -left-6 animation-delay-400">🌟</div>
              <div className="animate-bounce text-2xl absolute -bottom-4 -right-4 animation-delay-600">🎊</div>
            </div>
          )}
        </div>

        {/* Success Message */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">
            Story Submitted Successfully!
          </h1>
          <p className="text-xl text-muted-foreground max-w-lg mx-auto">
            Thank you for sharing your story. Your family will treasure these memories forever.
          </p>
        </div>

        {/* Story Details */}
        <FurbridgeCard className="p-6 text-left max-w-md mx-auto">
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">What happens next?</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-furbridge-orange rounded-full mt-2 flex-shrink-0"></div>
                <span>Your story is being transcribed automatically</span>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-furbridge-orange rounded-full mt-2 flex-shrink-0"></div>
                <span>Family members will be notified of your new story</span>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-furbridge-orange rounded-full mt-2 flex-shrink-0"></div>
                <span>They can listen, comment, and ask follow-up questions</span>
              </div>
            </div>
          </div>
        </FurbridgeCard>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/storyteller/record">
            <FurbridgeButton variant="orange" size="lg" className="w-full sm:w-auto">
              <Mic className="h-5 w-5 mr-2" />
              Record Another Story
            </FurbridgeButton>
          </Link>
          
          <Link href="/storyteller">
            <FurbridgeButton variant="outline" size="lg" className="w-full sm:w-auto">
              <Home className="h-5 w-5 mr-2" />
              Back to Home
            </FurbridgeButton>
          </Link>
        </div>

        {/* Encouragement Message */}
        <div className="bg-muted/50 rounded-lg p-6 max-w-lg mx-auto">
          <p className="text-sm text-muted-foreground italic">
            "Every story you share becomes a precious gift to future generations. 
            Your voice and memories are irreplaceable treasures."
          </p>
        </div>
      </div>
    </div>
  )
}
