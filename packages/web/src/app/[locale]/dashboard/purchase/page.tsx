'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Check,
  Star,
  Shield,
  Users,
  BookOpen,
  Sparkles,
  Mail,
  ArrowRight,
  Clock,
  Bell
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

export default function PurchasePage() {
  const t = useTranslations('purchase-page')
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [packageInterest, setPackageInterest] = useState<string>('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'en'
  const { user, getAccessToken } = useAuthStore()

  const withLocale = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`
    return `/${locale}${normalized}`
  }

  const handleWaitlistSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const token = await getAccessToken()
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          email,
          package_interest: packageInterest || undefined,
          message: message || undefined,
          source: 'purchase_page'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          toast.info('You are already on the waitlist!', {
            description: 'We will notify you when paid plans are available.'
          })
        } else {
          throw new Error(data.error || 'Failed to join waitlist')
        }
      } else {
        setSubmitted(true)
        toast.success('Successfully joined the waitlist!', {
          description: 'We will notify you when our paid plans launch.'
        })
      }
    } catch (error) {
      console.error('Waitlist signup error:', error)
      toast.error('Failed to join waitlist. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 flex items-center justify-center px-4">
        <Card className="max-w-2xl w-full">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              You're on the Waitlist!
            </h1>
            <p className="text-lg text-gray-700 mb-8">
              Thank you for your interest in UR Saga. We'll notify you at <strong>{email}</strong> when our paid plans launch.
            </p>
            <div className="bg-sage-50 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">What happens next?</h3>
              <ul className="text-left space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <Bell className="w-5 h-5 text-sage-600 mt-0.5 flex-shrink-0" />
                  <span>We'll send you early access when we launch paid features</span>
                </li>
                <li className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-sage-600 mt-0.5 flex-shrink-0" />
                  <span>You'll get exclusive waitlist member benefits</span>
                </li>
                <li className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-sage-600 mt-0.5 flex-shrink-0" />
                  <span>In the meantime, enjoy the free features available now</span>
                </li>
              </ul>
            </div>
            <Button
              onClick={() => router.push(withLocale('/dashboard'))}
              size="lg"
              className="text-lg"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="mb-6" variant="secondary">
            <Clock className="w-4 h-4 mr-2" />
            Coming Soon
          </Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Premium Features Launching Soon
          </h1>
          <p className="text-2xl text-gray-700 max-w-3xl mx-auto">
            Join the waitlist to get early access to our premium family biography platform
          </p>
        </div>

        {/* Hero Video/Image */}
        <div className="mb-16">
          <div className="relative bg-gradient-to-r from-sage-100 to-sage-200 rounded-2xl p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-sage-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <p className="text-xl text-sage-800 font-medium">
                Start capturing your family's stories today
              </p>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-sage-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Unlimited Collaboration</h3>
            <p className="text-lg text-gray-700">Invite unlimited family members to contribute stories</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-sage-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">AI-Powered Prompts</h3>
            <p className="text-lg text-gray-700">Smart questions that guide meaningful conversations</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-sage-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Secure & Private</h3>
            <p className="text-lg text-gray-700">Your family stories are safely stored and encrypted</p>
          </div>
        </div>

        {/* Pricing Preview */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Planned Pricing</h2>
            <p className="text-xl text-gray-700">One-time purchase, lifetime access</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card className="border-2 border-sage-200">
              <CardHeader className="text-center pb-6">
                <Badge className="mb-4 mx-auto w-fit">Most Popular</Badge>
                <CardTitle className="text-3xl">Family Heritage Package</CardTitle>
                <p className="text-gray-600 mt-2">Perfect for families who want to preserve their legacy</p>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-8">
                  <div className="text-5xl font-bold text-gray-900 mb-2">
                    $209
                    <span className="text-lg font-normal text-gray-600 ml-2">one-time</span>
                  </div>
                  <p className="text-gray-600">Lifetime access • No recurring fees</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Unlimited projects</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Unlimited family members</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>AI-powered smart prompts</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Automatic transcription</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Photo & audio attachments</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Cloud storage</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Mobile & web access</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Export to PDF & audio book</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Waitlist Form */}
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-sage-600" />
                Join the Waitlist
              </CardTitle>
              <p className="text-gray-600 mt-2">
                Be the first to know when we launch. Get exclusive early access and special pricing.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleWaitlistSignup} className="space-y-6">
                <div>
                  <Label htmlFor="email" className="text-base">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="h-12 text-lg"
                    required
                    defaultValue={user?.email || ''}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    We'll notify you when paid plans are available
                  </p>
                </div>

                <div>
                  <Label htmlFor="package" className="text-base">Which package interests you?</Label>
                  <Select value={packageInterest} onValueChange={setPackageInterest}>
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue placeholder="Select a package" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard ($149)</SelectItem>
                      <SelectItem value="premium">Premium ($209 - Most Popular)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (Custom)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="message" className="text-base">
                    Anything else you'd like to share? (Optional)
                  </Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your family story preservation needs..."
                    className="min-h-[100px] text-lg"
                    maxLength={500}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {message.length}/500 characters
                  </p>
                </div>

                <Separator />

                <Button
                  type="submit"
                  disabled={isLoading}
                  size="lg"
                  className="w-full text-xl font-bold py-6"
                >
                  {isLoading ? (
                    'Joining Waitlist...'
                  ) : (
                    <>
                      Join the Waitlist
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                <p className="text-sm text-gray-600 text-center">
                  By joining the waitlist, you agree to receive updates about UR Saga.
                  We respect your privacy and won't spam you.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Customer Reviews */}
        <div className="mt-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">What Early Users Say</h2>
            <div className="flex items-center justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-2 text-gray-600">4.9/5 from beta testers</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-900">Sarah Chen</p>
                    <p className="text-sm text-gray-600">Preserving family history</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700">
                  "This platform made it so easy to record my grandmother's stories. The AI prompts helped us uncover memories we'd never heard before."
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-900">Michael Rodriguez</p>
                    <p className="text-sm text-gray-600">Family historian</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700">
                  "I've been searching for a tool like this for years. The combination of audio, photos, and AI organization is perfect."
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-900">Emma Thompson</p>
                    <p className="text-sm text-gray-600">Creating family legacy</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700">
                  "The automatic transcription saved me hours of work. Now I can focus on what matters - spending time with my parents."
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
