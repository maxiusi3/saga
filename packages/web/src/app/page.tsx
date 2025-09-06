import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, MessageCircle, Heart, BookOpen } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-4 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center space-x-8">
          <div className="flex items-center">
            <div className="font-bold text-primary text-xl">FurBridge</div>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-sm font-medium transition-colors hover:text-primary text-muted-foreground">Features</a>
            <a href="#how-it-works" className="text-sm font-medium transition-colors hover:text-primary text-muted-foreground">How it Works</a>
            <Link href="/pricing" className="text-sm font-medium transition-colors hover:text-primary text-muted-foreground">Pricing</Link>
            <Link href="/about" className="text-sm font-medium transition-colors hover:text-primary text-muted-foreground">About</Link>
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
              <Link href="/learn-more">
                <Button variant="outline" size="lg">
                  Learn More
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
              <Link href="/learn-more">
                <Button variant="outline" size="lg">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
