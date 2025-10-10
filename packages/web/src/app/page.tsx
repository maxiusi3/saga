'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard, EnhancedCardContent, EnhancedCardDescription, EnhancedCardHeader, EnhancedCardTitle } from '@/components/ui/enhanced-card'
import { StatsCard } from '@/components/ui/stats-card'
import { Users, MessageCircle, Heart, BookOpen, Star, CheckCircle, Shield, Zap } from 'lucide-react'

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

      {/* Hero Section */}
      <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50">
        {/* Background Image Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"100\" height=\"100\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M0 0h100v100H0z\" fill=\"%232D5A3D\" fill-opacity=\".05\"/%3E%3C/svg%3E')",
          }}
        ></div>
        
        <div className="relative z-10 container mx-auto px-6 md:px-12 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
              Preserve Your Family's Voice.
              <br />
              <span className="text-gray-700">One Story at a Time.</span>
            </h1>
            <p className="text-lg md:text-xl max-w-2xl mx-auto text-gray-600 leading-relaxed">
              Saga's AI-guided prompts help parents record memories while children learn
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/auth/signin">
                <Button 
                  size="lg"
                  className="bg-[#F59E0B] hover:bg-[#D97706] text-white px-8 py-6 text-lg font-semibold"
                >
                  Start Your Free Trial
                </Button>
              </Link>
              <Link href="/design-showcase">
                <Button 
                  variant="outline"
                  size="lg"
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-6 text-lg font-semibold"
                >
                  Watch Demo
                </Button>
              </Link>
            </div>
            <p className="text-sm text-gray-500 pt-4">
              Trusted by <span className="font-semibold text-gray-700">10,000+</span> families
            </p>
          </div>
        </div>
      </section>

      {/* Product Showcase Section */}
      <section className="py-20 bg-gradient-to-br from-muted/30 to-background">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Beautiful, Intuitive Design
            </h2>
            <p className="text-lg md:text-xl max-w-3xl mx-auto text-muted-foreground">
              Our platform is designed with families in mind - simple enough for grandparents, powerful enough for preserving generations of stories.
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            {/* Mock Product Interface */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                {/* Mock Browser Header */}
                <div className="bg-gray-100 px-4 py-3 flex items-center space-x-2 border-b">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="bg-white rounded-md px-4 py-1 text-sm text-gray-600 inline-block">
                      saga.family/dashboard
                    </div>
                  </div>
                </div>
                
                {/* Mock Interface Content */}
                <div className="p-8 bg-gradient-to-br from-white to-primary/5">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel - Story List */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-bold text-foreground">Recent Stories</h3>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-primary/20 rounded-full animate-pulse"></div>
                          <div className="w-8 h-8 bg-secondary/20 rounded-full animate-pulse delay-200"></div>
                        </div>
                      </div>
                      
                      {/* Mock Story Cards */}
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                          <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center">
                              <div className="w-6 h-6 bg-primary/40 rounded-full animate-pulse"></div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <div className="h-4 bg-gray-300 rounded w-32 animate-pulse"></div>
                                <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                              </div>
                              <div className="space-y-2">
                                <div className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
                                <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Right Panel - Stats */}
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg p-6">
                        <h4 className="font-semibold text-foreground mb-4">Project Progress</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Stories Recorded</span>
                            <span className="font-medium">12</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full w-3/4"></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h4 className="font-semibold text-foreground mb-4">Family Members</h4>
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full"></div>
                              <div className="flex-1">
                                <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-primary/20 rounded-full animate-bounce"></div>
              <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-secondary/20 rounded-full animate-bounce delay-500"></div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-brown mb-6">
              How Saga Works
            </h2>
            <p className="text-lg md:text-xl max-w-3xl mx-auto text-muted-foreground">
              Simple, meaningful conversations that preserve your family's legacy through our guided storytelling process.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <EnhancedCard variant="interactive" className="group bg-gradient-to-br from-white to-primary/5 border-primary/20 hover:border-primary/40">
              <EnhancedCardHeader className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center animate-float group-hover:animate-glow">
                  <BookOpen className="w-8 h-8 text-primary" />
                </div>
                <EnhancedCardTitle className="text-xl text-foreground group-hover:text-primary transition-colors">
                  Create Your Project
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <EnhancedCardDescription className="text-center text-base">
                  Set up a family story project and invite your storyteller. Our platform makes it easy to get started with guided setup.
                </EnhancedCardDescription>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard variant="interactive" className="group bg-gradient-to-br from-white to-secondary/5 border-secondary/20 hover:border-secondary/40">
              <EnhancedCardHeader className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center animate-float delay-200 group-hover:animate-glow">
                  <MessageCircle className="w-8 h-8 text-secondary" />
                </div>
                <EnhancedCardTitle className="text-xl text-foreground group-hover:text-secondary transition-colors">
                  Guided Conversations
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <EnhancedCardDescription className="text-center text-base">
                  AI-powered prompts help facilitate meaningful discussions and capture the essence of your family's unique story.
                </EnhancedCardDescription>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard variant="interactive" className="group bg-gradient-to-br from-white to-primary/5 border-primary/20 hover:border-primary/40">
              <EnhancedCardHeader className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center animate-float delay-500 group-hover:animate-glow">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <EnhancedCardTitle className="text-xl text-foreground group-hover:text-primary transition-colors">
                  Preserve Forever
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <EnhancedCardDescription className="text-center text-base">
                  Stories are transcribed, organized, and beautifully formatted, ready to share with future generations.
                </EnhancedCardDescription>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-brown mb-6">
              Why Choose Saga?
            </h2>
            <p className="text-lg md:text-xl max-w-3xl mx-auto text-muted-foreground">
              Our platform is designed specifically for families who want to preserve their stories for generations to come.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Happy Families"
              value="1000+"
              description="Trust us with their precious memories"
              icon={<Users className="w-6 h-6" />}
              trend={{ value: 15, label: "vs last month", direction: "up" }}
              variant="success"
              className="bg-gradient-to-br from-white to-primary/5 border-primary/20 hover:border-primary/40"
            />
            <StatsCard
              title="Stories Preserved"
              value="5000+"
              description="Unique family stories captured"
              icon={<MessageCircle className="w-6 h-6" />}
              trend={{ value: 23, label: "vs last month", direction: "up" }}
              variant="info"
              className="bg-gradient-to-br from-white to-secondary/5 border-secondary/20 hover:border-secondary/40"
            />
            <StatsCard
              title="Satisfaction Rate"
              value="99%"
              description="Users love our experience"
              icon={<Heart className="w-6 h-6" />}
              trend={{ value: 2, label: "vs last month", direction: "up" }}
              variant="success"
              className="bg-gradient-to-br from-white to-primary/5 border-primary/20 hover:border-primary/40"
            />
            <StatsCard
              title="24/7 Support"
              value="100%"
              description="Always here to help"
              icon={<Shield className="w-6 h-6" />}
              variant="info"
              className="bg-gradient-to-br from-white to-secondary/5 border-secondary/20 hover:border-secondary/40"
            />
          </div>
        </div>
      </section>

      {/* Detailed Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Everything You Need to Capture Family Stories
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our platform is designed to make storytelling natural, meaningful, and accessible for everyone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <EnhancedCard variant="default" className="p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    AI-Powered Prompts
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Thoughtfully crafted questions that help guide meaningful conversations and unlock precious memories.
                  </p>
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard variant="default" className="p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-secondary to-primary rounded-xl flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Automatic Transcription
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Every story is automatically transcribed with high accuracy, making them searchable and easy to share.
                  </p>
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard variant="default" className="p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Family Collaboration
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Invite multiple family members to participate, ask follow-up questions, and add their own memories.
                  </p>
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard variant="default" className="p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-secondary to-primary rounded-xl flex items-center justify-center">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Secure & Private
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Your family stories are kept private and secure, accessible only to invited family members.
                  </p>
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard variant="default" className="p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Multiple Export Options
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Export your complete family archive in various formats for safekeeping and sharing.
                  </p>
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard variant="default" className="p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-secondary to-primary rounded-xl flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Mobile Friendly
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Easy-to-use interface designed for storytellers of all ages and technical comfort levels.
                  </p>
                </div>
              </div>
            </EnhancedCard>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              How Saga Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Three simple steps to start preserving your family's stories
            </p>
          </div>

          <div className="space-y-12">
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                  1
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Create Your Project
                </h3>
                <p className="text-muted-foreground">
                  Set up a family story project and invite your storyteller. Our platform guides you through
                  the setup process and helps you get started with meaningful prompts.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                  2
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Record Stories
                </h3>
                <p className="text-muted-foreground">
                  Your storyteller uses our simple recording interface to share their memories.
                  AI-powered prompts help guide the conversation and unlock precious stories.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                  3
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Preserve & Share
                </h3>
                <p className="text-muted-foreground">
                  Stories are automatically transcribed and organized. Family members can listen,
                  comment, ask follow-up questions, and export the complete archive.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary to-secondary text-primary-foreground relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.1),transparent_50%)]"></div>
        
        {/* Floating Elements */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-white/5 rounded-full blur-xl animate-pulse delay-1000"></div>
        
        <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 animate-fade-in">
              Start Capturing Your Family's Story Today
            </h2>
            <p className="text-lg md:text-xl mb-8 opacity-90 animate-fade-in-delay">
              Join thousands of families preserving their precious memories with Saga's intelligent storytelling platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center animate-fade-in-delay-2">
              <Link href="/auth/signin">
                <EnhancedButton 
                  variant="secondary" 
                  size="xl" 
                  className="bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl border-2 border-white/20"
                  rightIcon={<BookOpen className="w-5 h-5" />}
                >
                  Begin Your Journey
                </EnhancedButton>
              </Link>
              <Link href="/design-showcase">
                <EnhancedButton 
                  variant="outline" 
                  size="xl"
                  className="border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50"
                >
                  View Demo
                </EnhancedButton>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 border-t border-border/50 py-12">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div className="font-bold text-primary text-2xl">Saga</div>
              </div>
              <p className="text-muted-foreground mb-4 max-w-md">
                Preserve your family's precious memories through guided conversations and AI-powered storytelling.
              </p>
              {/* Turbo0 Badge */}
              <div className="mt-4">
                <a href="https://turbo0.com/item/saga" target="_blank" rel="noopener noreferrer">
                  <img 
                    src="https://img.turbo0.com/badge-listed-light.svg" 
                    alt="Listed on Turbo0" 
                    style={{ height: '54px', width: 'auto' }} 
                  />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Product</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="#features" className="text-muted-foreground hover:text-primary transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="text-muted-foreground hover:text-primary transition-colors">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/design-showcase" className="text-muted-foreground hover:text-primary transition-colors">
                    Demo
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-border/50">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} Saga. All rights reserved.
              </p>
              <div className="flex items-center space-x-6">
                <a 
                  href="https://turbo0.com/item/saga" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Listed on Turbo0
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
