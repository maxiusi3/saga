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
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(45,90,61,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(74,124,89,0.1),transparent_50%)]"></div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-secondary/10 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-primary/5 rounded-full blur-lg animate-bounce delay-500"></div>
        
        <div className="relative z-10 container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold text-foreground animate-fade-in">
              <span className="font-bold">
                Your family's story,{' '}
                <span className="text-primary bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  a conversation away
                </span>
              </span>
            </h1>
            <p className="text-lg md:text-xl max-w-2xl mx-auto text-muted-foreground animate-fade-in-delay">
              Capture precious memories through guided conversations with your loved ones. Preserve your family's legacy with AI-powered storytelling tools.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-fade-in-delay-2">
              <Link href="/auth/signin">
                <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
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
            <Card className="group card-enhanced bg-gradient-to-br from-white to-primary/5 border-primary/20 hover:border-primary/40">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-2xl animate-float group-hover:animate-glow">
                  📖
                </div>
                <CardTitle className="text-foreground group-hover:text-primary transition-colors">Create Your Project</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Set up a family story project and invite your storyteller. Our platform makes it easy to get started.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="group card-enhanced bg-gradient-to-br from-white to-secondary/5 border-secondary/20 hover:border-secondary/40">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center text-2xl animate-float delay-200 group-hover:animate-glow">
                  💬
                </div>
                <CardTitle className="text-foreground group-hover:text-secondary transition-colors">Guided Conversations</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  AI-powered prompts help facilitate meaningful discussions and capture the essence of your family's story.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="group card-enhanced bg-gradient-to-br from-white to-primary/5 border-primary/20 hover:border-primary/40">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-2xl animate-float delay-500 group-hover:animate-glow">
                  💎
                </div>
                <CardTitle className="text-foreground group-hover:text-primary transition-colors">Preserve Forever</CardTitle>
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
            <Card className="p-6 text-center card-enhanced bg-gradient-to-br from-white to-primary/5 border-primary/20 hover:border-primary/40 group">
              <div className="flex justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Users className="w-8 h-8" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold gradient-text">1000+</div>
                <div className="text-md font-medium text-foreground">Happy Families</div>
                <p className="text-sm text-muted-foreground">Families trust us with their most precious memories</p>
              </div>
            </Card>
            <Card className="p-6 text-center card-enhanced bg-gradient-to-br from-white to-secondary/5 border-secondary/20 hover:border-secondary/40 group">
              <div className="flex justify-center mb-4 text-secondary group-hover:scale-110 transition-transform">
                <div className="p-3 rounded-full bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
                  <MessageCircle className="w-8 h-8" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold gradient-text">5000+</div>
                <div className="text-md font-medium text-foreground">Stories Preserved</div>
                <p className="text-sm text-muted-foreground">Unique family stories captured and organized</p>
              </div>
            </Card>
            <Card className="p-6 text-center card-enhanced bg-gradient-to-br from-white to-primary/5 border-primary/20 hover:border-primary/40 group">
              <div className="flex justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Heart className="w-8 h-8" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold gradient-text">99%</div>
                <div className="text-md font-medium text-foreground">Satisfaction Rate</div>
                <p className="text-sm text-muted-foreground">Our users love the experience we provide</p>
              </div>
            </Card>
            <Card className="p-6 text-center card-enhanced bg-gradient-to-br from-white to-secondary/5 border-secondary/20 hover:border-secondary/40 group">
              <div className="flex justify-center mb-4 text-secondary group-hover:scale-110 transition-transform">
                <div className="p-3 rounded-full bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
                  <BookOpen className="w-8 h-8" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold gradient-text">24/7</div>
                <div className="text-md font-medium text-foreground">Support</div>
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
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-delay-2">
              <Link href="/auth/signin">
                <Button variant="secondary" size="lg" className="btn-enhanced bg-white text-primary hover:bg-white/90 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
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
