'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Shield, Lock, Users, Eye, Heart } from 'lucide-react'
import { Suspense } from 'react'

function PrivacyPledgeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  
  const nextUrl = searchParams?.get('next') || '/dashboard'

  const handleAgree = async () => {
    setIsLoading(true)

    try {
      // Record user's agreement in database
      const response = await fetch('/api/privacy-pledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: '1.0',
          ip_address: null // Could be obtained from a service if needed
        })
      })

      if (!response.ok) {
        throw new Error('Failed to record privacy agreement')
      }

      const result = await response.json()
      console.log('Privacy agreement recorded:', result)

      // Navigate to next page
      router.push(nextUrl)
    } catch (error) {
      console.error('Error recording privacy agreement:', error)
      // Still navigate even if recording fails
      router.push(nextUrl)
    } finally {
      setIsLoading(false)
    }
  }

  const privacyPoints = [
    {
      icon: <Lock className="h-6 w-6 text-teal-500" />,
      title: "Your Stories Stay Private",
      description: "Only invited family members can see your stories. We never share your content with anyone else."
    },
    {
      icon: <Users className="h-6 w-6 text-primary" />,
      title: "Family-Only Access",
      description: "Each story project is completely private to your family. Other families cannot see your content."
    },
    {
      icon: <Shield className="h-6 w-6 text-warm-gray-500" />,
      title: "Secure Storage",
      description: "Your stories are encrypted and stored securely. We use industry-standard security practices."
    },
    {
      icon: <Eye className="h-6 w-6 text-teal-500" />,
      title: "You Control Your Data",
      description: "You can download, edit, or delete your stories at any time. Your data belongs to you."
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-gray-500/10 to-teal-500/10 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Heart className="h-10 w-10 text-primary" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-foreground">
            Your Stories are Private
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Before we begin, we want you to know exactly how we protect your precious memories.
          </p>
        </div>

        {/* Privacy Points */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {privacyPoints.map((point, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {point.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {point.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {point.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Main Promise */}
        <Card className="p-8 text-center bg-gradient-to-r from-primary/5 to-teal-500/5 border-2 border-primary/20">
          <div className="space-y-6">
            <div className="flex justify-center">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">
                Our Privacy Pledge to You
              </h2>
              
              <div className="text-left max-w-2xl mx-auto space-y-4 text-muted-foreground">
                <p className="text-lg">
                  <strong>Everything you share is only visible to the family members in this project.</strong>
                </p>
                
                <ul className="space-y-2 text-base">
                  <li className="flex items-start space-x-2">
                    <span className="text-primary mt-1">•</span>
                    <span>We will never sell, share, or use your stories for any purpose other than providing this service to your family.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Your stories are encrypted and stored securely on our servers.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-primary mt-1">•</span>
                    <span>You can export or delete your stories at any time.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Only invited family members can access your project.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {/* Agreement Section */}
        <Card className="p-8">
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Ready to Share Your Stories?
              </h3>
              <p className="text-muted-foreground">
                By continuing, you acknowledge that you understand how we protect your privacy 
                and agree to share your stories with your invited family members.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="min-w-32"
              >
                Go Back
              </Button>
              
              <Button
                size="lg"
                onClick={handleAgree}
                disabled={isLoading}
                className="min-w-48"
              >
                {isLoading ? 'Getting Started...' : 'I Understand and Agree'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Footer Links */}
        <div className="text-center text-sm text-muted-foreground space-x-4">
          <a href="/privacy" className="hover:text-foreground underline">
            Full Privacy Policy
          </a>
          <span>•</span>
          <a href="/terms" className="hover:text-foreground underline">
            Terms of Service
          </a>
          <span>•</span>
          <a href="mailto:privacy@saga.family" className="hover:text-foreground underline">
            Privacy Questions
          </a>
        </div>
      </div>
    </div>
  )
}

export default function PrivacyPledgePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-warm-gray-500/10 to-teal-500/10 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <PrivacyPledgeContent />
    </Suspense>
  )
}
