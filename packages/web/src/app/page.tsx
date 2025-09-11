'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, MessageCircle, Heart, BookOpen } from 'lucide-react'

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
            const response = await fetch('/api/invitations/check-pending', {
              credentials: 'include', // 确保包含认证信息
              headers: {
                'Content-Type': 'application/json'
              }
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
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-4 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center space-x-8">
          <div className="flex items-center">
            <div className="font-bold text-primary text-xl">Saga</div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/auth/signin">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/auth/signin">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center">
        <div className="relative z-10 container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold text-brown">
              <span className="font-bold">
                Your family's story,{' '}
                <span className="text-primary">a conversation away</span>
              </span>
            </h1>
            <p className="text-lg md:text-xl max-w-2xl mx-auto text-muted-foreground">
              Capture precious memories through guided conversations with your loved ones. Preserve your family's legacy with AI-powered storytelling tools.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/auth/signin">
                <Button size="lg">
                  Start Your Saga
                  <BookOpen className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-8">
              <div className="flex items-center gap-2 text-brown">
                <Users className="w-6 h-6" />
                <div className="text-left">
                  <div className="text-2xl font-bold">1000+</div>
                  <div className="text-sm text-muted-foreground">Families</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-brown">
                <MessageCircle className="w-6 h-6" />
                <div className="text-left">
                  <div className="text-2xl font-bold">5000+</div>
                  <div className="text-sm text-muted-foreground">Stories Preserved</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-brown">
                <Heart className="w-6 h-6" />
                <div className="text-left">
                  <div className="text-2xl font-bold">99%</div>
                  <div className="text-sm text-muted-foreground">Satisfaction</div>
                </div>
              </div>
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
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  📖
                </div>
                <CardTitle className="text-brown">Create Your Project</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Set up a family story project and invite your storyteller. Our platform makes it easy to get started.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/10 flex items-center justify-center text-2xl">
                  💬
                </div>
                <CardTitle className="text-brown">Guided Conversations</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  AI-powered prompts help facilitate meaningful discussions and capture the essence of your family's story.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brown/10 flex items-center justify-center text-2xl">
                  💎
                </div>
                <CardTitle className="text-brown">Preserve Forever</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Stories are transcribed, organized, and beautifully formatted, ready to share with future generations.
                </CardDescription>
              </CardContent>
            </Card>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4 text-primary">
                <Users className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-primary">1000+</div>
                <div className="text-md font-medium">Happy Families</div>
                <p className="text-sm text-muted-foreground">Families trust us with their most precious memories</p>
              </div>
            </Card>
            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4 text-primary">
                <MessageCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-primary">5000+</div>
                <div className="text-md font-medium">Stories Preserved</div>
                <p className="text-sm text-muted-foreground">Unique family stories captured and organized</p>
              </div>
            </Card>
            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4 text-primary">
                <Heart className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-primary">99%</div>
                <div className="text-md font-medium">Satisfaction Rate</div>
                <p className="text-sm text-muted-foreground">Our users love the experience we provide</p>
              </div>
            </Card>
            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4 text-primary">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-primary">24/7</div>
                <div className="text-md font-medium">Support</div>
                <p className="text-sm text-muted-foreground">We're here whenever you need assistance</p>
              </div>
            </Card>
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
            <Card className="p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    AI-Powered Prompts
                  </h3>
                  <p className="text-muted-foreground">
                    Thoughtfully crafted questions that help guide meaningful conversations and unlock precious memories.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Automatic Transcription
                  </h3>
                  <p className="text-muted-foreground">
                    Every story is automatically transcribed with high accuracy, making them searchable and easy to share.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Family Collaboration
                  </h3>
                  <p className="text-muted-foreground">
                    Invite multiple family members to participate, ask follow-up questions, and add their own memories.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Secure & Private
                  </h3>
                  <p className="text-muted-foreground">
                    Your family stories are kept private and secure, accessible only to invited family members.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Multiple Export Options
                  </h3>
                  <p className="text-muted-foreground">
                    Export your complete family archive in various formats for safekeeping and sharing.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Mobile Friendly
                  </h3>
                  <p className="text-muted-foreground">
                    Easy-to-use interface designed for storytellers of all ages and technical comfort levels.
                  </p>
                </div>
              </div>
            </Card>
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
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Start Capturing Your Family's Story Today
            </h2>
            <p className="text-lg md:text-xl mb-8 opacity-90">
              Join thousands of families preserving their precious memories with Saga's intelligent storytelling platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signin">
                <Button variant="secondary" size="lg">
                  Begin Your Journey
                  <BookOpen className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
