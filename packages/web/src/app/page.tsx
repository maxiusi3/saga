'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard, EnhancedCardContent, EnhancedCardDescription, EnhancedCardHeader, EnhancedCardTitle } from '@/components/ui/enhanced-card'
import { StatsCard } from '@/components/ui/stats-card'
import { Users, MessageCircle, Heart, BookOpen, CheckCircle, Shield, Zap, ChevronDown, Play, Mic, Globe, Lock, Download, Smartphone, Monitor, Archive, UserPlus, Calendar, Camera } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Check if URL contains auth tokens from Supabase
    const urlParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))

    const accessToken = urlParams.get('access_token') || hashParams.get('access_token')
    const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token')
    const tokenType = urlParams.get('token_type') || hashParams.get('token_type')
    const type = urlParams.get('type') || hashParams.get('type')
    const token = urlParams.get('token') || hashParams.get('token') ||
      urlParams.get('confirmation_token') || hashParams.get('confirmation_token') ||
      urlParams.get('invite_token') || hashParams.get('invite_token')

    console.log('Home page: Checking URL params', {
      accessToken: !!accessToken,
      refreshToken: !!refreshToken,
      tokenType,
      type,
      token: !!token,
      search: window.location.search,
      hash: window.location.hash,
      allSearchParams: Object.fromEntries(urlParams.entries()),
      allHashParams: Object.fromEntries(hashParams.entries())
    })

    if (accessToken && refreshToken && type === 'magiclink') {
      console.log('Home page: Magic Link tokens found, redirecting to dashboard')
      // Redirect to dashboard with tokens
      router.push(`/dashboard?access_token=${accessToken}&refresh_token=${refreshToken}&token_type=${tokenType}&type=${type}`)
    } else if (type === 'invite') {
      console.log('Home page: Invitation type detected, checking for pending invitations')
      // For invitations, we need to check if the user has pending invitations
      // Since the user is already authenticated, we can check their email against pending invitations
      checkPendingInvitations()
    }

    async function checkPendingInvitations() {
      try {
        // Wait longer for auth to fully initialize and retry multiple times
        let retryCount = 0
        const maxRetries = 3

        const checkWithRetry = async () => {
          console.log(`Home page: Checking pending invitations API... (attempt ${retryCount + 1})`)

          try {
            // 获取认证 token
            const { createClient } = await import('@supabase/supabase-js')
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            )
            const { data: { session } } = await supabase.auth.getSession()

            const headers: Record<string, string> = {
              'Content-Type': 'application/json'
            }

            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const response = await fetch('/api/invitations/check-pending', {
              credentials: 'include',
              headers
            })
            console.log('Home page: API response status:', response.status)

            if (response.ok) {
              const data = await response.json()
              console.log('Home page: API response data:', data)

              if (data.hasPendingInvitations) {
                console.log('Home page: Found pending invitations, redirecting to accept-invitation')
                router.push('/accept-invitation')
                return true
              } else {
                console.log('Home page: No pending invitations found')
                return false
              }
            } else if (response.status === 401 && retryCount < maxRetries - 1) {
              console.log('Home page: Auth not ready, retrying...')
              retryCount++
              setTimeout(checkWithRetry, 2000) // 等待更长时间重试
              return
            } else {
              console.log('Home page: API call failed:', response.status)
              return false
            }
          } catch (error) {
            console.error('Home page: API call error:', error)
            if (retryCount < maxRetries - 1) {
              retryCount++
              setTimeout(checkWithRetry, 2000)
              return
            }
            return false
          }
        }

        // 初始延迟后开始检查
        setTimeout(checkWithRetry, 2000)
      } catch (error) {
        console.error('Error checking pending invitations:', error)
      }
    }
  }, [router])
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 md:px-12 lg:px-16 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-12">
          <div className="font-bold text-gray-900 text-2xl">Saga</div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-700 hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="text-gray-700 hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#testimonials" className="text-gray-700 hover:text-gray-900 transition-colors">Testimonials</a>
            <a href="#faq" className="text-gray-700 hover:text-gray-900 transition-colors">FAQ</a>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Link href="/auth/signin">
            <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
              Login
            </Button>
          </Link>
          <Link href="/auth/signin">
            <Button className="bg-[#2D5A3D] hover:bg-[#234a31] text-white">
              Sign Up
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section with Family Photo Background */}
      <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=2070')",
          }}
        >
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-[#2D5A3D]/70"></div>
        </div>

        <div className="relative z-10 container mx-auto px-6 md:px-12 text-center py-20">
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
              Preserve Your Family's Voice.
              <br />
              One Story at a Time.
            </h1>
            <p className="text-lg md:text-xl max-w-2xl mx-auto text-white/90 leading-relaxed">
              Saga's AI-guided prompts help parents record memories while children learn
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/auth/signin">
                <Button
                  size="lg"
                  className="bg-[#F59E0B] hover:bg-[#D97706] text-white px-8 py-6 text-lg font-semibold shadow-lg"
                >
                  Start Your Free Trial
                </Button>
              </Link>
              <Link href="/design-showcase">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg font-semibold"
                >
                  Watch Demo
                </Button>
              </Link>
            </div>
            <p className="text-sm text-white/80 pt-4">
              Trusted by <span className="font-semibold text-white">10,000+</span> families
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Features
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="text-center p-8 bg-gray-50 rounded-2xl">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Guided Prompts</h3>
              <p className="text-gray-600 leading-relaxed">
                AI-powered conversation starters and personalized questions from expert family historians
              </p>
            </div>

            <div className="text-center p-8 bg-gray-50 rounded-2xl">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Easy Recording</h3>
              <p className="text-gray-600 leading-relaxed">
                Simple interface for parents, works with any device
              </p>
            </div>

            <div className="text-center p-8 bg-gray-50 rounded-2xl">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Interactive Follow-Up</h3>
              <p className="text-gray-600 leading-relaxed">
                Facilitate two-way dialogue, questions and personalized learning
              </p>
            </div>
          </div>

          {/* Device Mockup */}
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <Image
                src="https://images.unsplash.com/photo-1551650975-87deedd944c3?q=80&w=2074"
                alt="Saga app on mobile and desktop"
                width={800}
                height={500}
                className="w-full rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Product Showcase Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Product Showcase
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-white rounded-2xl shadow-sm">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">AI-Guided Conversations</h3>
              <p className="text-gray-600 leading-relaxed">
                Smart prompts that adapt to your family's unique stories and interests
              </p>
            </div>

            <div className="text-center p-8 bg-white rounded-2xl shadow-sm">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Cross-Platform Access</h3>
              <p className="text-gray-600 leading-relaxed">
                Seamlessly record and share on web, mobile, and any connected device
              </p>
            </div>

            <div className="text-center p-8 bg-white rounded-2xl shadow-sm">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <Archive className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Secure Family Archive</h3>
              <p className="text-gray-600 leading-relaxed">
                Enterprise-grade encrypted storage keeps your memories safe forever
              </p>
            </div>

            <div className="text-center p-8 bg-white rounded-2xl shadow-sm">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Real-time Transcription</h3>
              <p className="text-gray-600 leading-relaxed">
                Automatic voice-to-text conversion with high accuracy and editing tools
              </p>
            </div>

            <div className="text-center p-8 bg-white rounded-2xl shadow-sm">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Multi-Generation Collaboration</h3>
              <p className="text-gray-600 leading-relaxed">
                Easy family sharing that connects grandparents with grandchildren
              </p>
            </div>

            <div className="text-center p-8 bg-white rounded-2xl shadow-sm">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <Download className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Lifetime Data Ownership</h3>
              <p className="text-gray-600 leading-relaxed">
                Your stories belong to you with permanent access and export options
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What Families Say Section */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-8">
              What Families Say
            </h2>
            <div className="flex justify-center space-x-16 mb-12">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900">50,000+</div>
                <div className="text-gray-600">Stories Preserved</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900">99%</div>
                <div className="text-gray-600">Parent Satisfaction</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-8 rounded-2xl">
              <div className="flex items-center mb-4">
                <Image
                  src="https://images.unsplash.com/photo-1494790108755-2616b612b786?q=80&w=150"
                  alt="Sarah Johnson"
                  width={50}
                  height={50}
                  className="rounded-full mr-4"
                />
                <div>
                  <div className="font-semibold text-gray-900">Sarah Johnson</div>
                </div>
              </div>
              <p className="text-gray-600 leading-relaxed">
                "Saga helped us capture my mother's stories before it was too late. The prompts made conversations so natural."
              </p>
            </div>

            <div className="bg-gray-50 p-8 rounded-2xl">
              <div className="flex items-center mb-4">
                <Image
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150"
                  alt="Michael Chen"
                  width={50}
                  height={50}
                  className="rounded-full mr-4"
                />
                <div>
                  <div className="font-semibold text-gray-900">Michael Chen</div>
                </div>
              </div>
              <p className="text-gray-600 leading-relaxed">
                "My kids are now excited to call grandpa every week. Saga turned family time into something magical."
              </p>
            </div>

            <div className="bg-gray-50 p-8 rounded-2xl">
              <div className="flex items-center mb-4">
                <Image
                  src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150"
                  alt="Dorothy Wilson"
                  width={50}
                  height={50}
                  className="rounded-full mr-4"
                />
                <div>
                  <div className="font-semibold text-gray-900">Dorothy Wilson</div>
                </div>
              </div>
              <p className="text-gray-600 leading-relaxed">
                "I never thought I'd enjoy technology, but Saga makes sharing my stories so simple. My grandchildren love listening."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Perfect for Every Family Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Perfect for Every Family
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm">
              <Image
                src="https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=400"
                alt="Multi-generational family"
                width={400}
                height={250}
                className="w-full h-48 object-cover rounded-xl mb-6"
              />
              <h3 className="text-xl font-bold text-gray-900 mb-4">Multi-generational Families</h3>
              <p className="text-gray-600 leading-relaxed">
                Connecting grandparents with grandchildren through guided conversations and shared memories
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm">
              <Image
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400"
                alt="Busy adult children"
                width={400}
                height={250}
                className="w-full h-48 object-cover rounded-xl mb-6"
              />
              <h3 className="text-xl font-bold text-gray-900 mb-4">Busy Adult Children</h3>
              <p className="text-gray-600 leading-relaxed">
                Staying connected despite distance and schedules with meaningful conversations
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm">
              <Image
                src="https://images.unsplash.com/photo-1609220136736-443140cffec6?q=80&w=400"
                alt="Family history preservation"
                width={400}
                height={250}
                className="w-full h-48 object-cover rounded-xl mb-6"
              />
              <h3 className="text-xl font-bold text-gray-900 mb-4">Family History Preservation</h3>
              <p className="text-gray-600 leading-relaxed">
                Creating lasting legacy archives with stories that matter most
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm">
              <Image
                src="https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=400"
                alt="Special occasions"
                width={400}
                height={250}
                className="w-full h-48 object-cover rounded-xl mb-6"
              />
              <h3 className="text-xl font-bold text-gray-900 mb-4">Special Occasions</h3>
              <p className="text-gray-600 leading-relaxed">
                Holiday traditions and milestone celebrations captured forever
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Your Family's Privacy is Our Priority
            </h2>
            <p className="text-lg md:text-xl max-w-3xl mx-auto text-gray-600">
              Your precious family memories deserve the highest level of security and privacy protection
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="text-center p-8 bg-gray-50 rounded-2xl">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Enterprise Encryption</h3>
              <p className="text-gray-600 leading-relaxed">
                Bank-level 256-bit encryption protects your family stories at rest and in transit
              </p>
            </div>

            <div className="text-center p-8 bg-gray-50 rounded-2xl">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Complete Ownership</h3>
              <p className="text-gray-600 leading-relaxed">
                Your stories belong to you. We never share, sell, or use your family's data
              </p>
            </div>

            <div className="text-center p-8 bg-gray-50 rounded-2xl">
              <div className="w-16 h-16 bg-[#F59E0B] rounded-full mx-auto mb-6 flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Private Storage</h3>
              <p className="text-gray-600 leading-relaxed">
                Secure cloud storage with multiple backups ensures your memories are safe forever
              </p>
            </div>
          </div>

          <div className="text-center">
            <div className="flex justify-center space-x-8 text-sm text-gray-500">
              <span>GDPR Compliant</span>
              <span>SOC 2 Certified</span>
              <span>ISO 27001</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-[#2D5A3D] text-white">
        <div className="container mx-auto px-6 md:px-12 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              Don't Let Another Day Pass Without
              <br />
              Preserving Your Family's Stories
            </h2>
            <p className="text-lg md:text-xl max-w-3xl mx-auto text-white/90 leading-relaxed">
              Every conversation is irreplaceable. Every memory matters. Start capturing the voices
              and wisdom that make your family unique before time passes by.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/auth/signin">
                <Button
                  size="lg"
                  className="bg-[#F59E0B] hover:bg-[#D97706] text-white px-8 py-6 text-lg font-semibold shadow-lg"
                >
                  Start Your Family's Saga - $99
                </Button>
              </Link>
              <Link href="/design-showcase">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg font-semibold"
                >
                  Schedule a Demo
                </Button>
              </Link>
            </div>
            <div className="flex justify-center space-x-8 text-sm text-white/80 pt-4">
              <span>30-day guarantee</span>
              <span>Setup in 5 minutes</span>
              <span>Lifetime access</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-gray-50">
        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                question: "How does the AI guidance work?",
                answer: "Our AI system provides thoughtfully crafted prompts and questions that adapt to your family's unique stories and interests, helping facilitate natural conversations."
              },
              {
                question: "Is my family's data secure and private?",
                answer: "Yes, absolutely. We use enterprise-grade encryption and never share, sell, or use your family's data. Your stories belong to you with complete ownership and privacy."
              },
              {
                question: "What devices are supported?",
                answer: "Saga works seamlessly across all devices - web browsers, iOS and Android mobile apps, tablets, and any device with internet access."
              },
              {
                question: "How do I invite family members?",
                answer: "Simply send invitation links through the platform. Family members can join with any device and start participating in conversations immediately."
              },
              {
                question: "What happens to stories after subscription ends?",
                answer: "You maintain lifetime access to all your stories. After your subscription, the archive enters read-only mode with full export capabilities."
              },
              {
                question: "Can I export our family archive?",
                answer: "Yes, you can export your complete family archive in multiple formats including PDF, audio files, and structured data formats for permanent safekeeping."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm">
                <button
                  className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
                  onClick={() => toggleFaq(index)}
                >
                  <span className="font-semibold text-gray-900">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-500 transition-transform ${openFaq === index ? 'rotate-180' : ''
                      }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#2D5A3D] text-white py-16">
        <div className="container mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="font-bold text-2xl mb-4">Saga</div>
              <p className="text-white/80 leading-relaxed">
                Connecting families through stories
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-4">Navigation</h4>
              <div className="space-y-2">
                <a href="#" className="block text-white/80 hover:text-white transition-colors">About Us</a>
                <a href="#" className="block text-white/80 hover:text-white transition-colors">How It Works</a>
                <a href="#pricing" className="block text-white/80 hover:text-white transition-colors">Pricing</a>
                <a href="#" className="block text-white/80 hover:text-white transition-colors">Contact</a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-4">Company</h4>
              <div className="space-y-2">
                <Link href="/privacy" className="block text-white/80 hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="block text-white/80 hover:text-white transition-colors">Terms of Service</Link>
                <a href="#" className="block text-white/80 hover:text-white transition-colors">Security</a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-4">Stay Updated</h4>
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                />
                <Button className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-white">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t border-white/20 mt-12 pt-8 text-center">
            <p className="text-white/60">
              © 2024 Saga. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
