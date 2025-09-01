import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-background to-muted/20 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground">
              Your family's story, a conversation away
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Capture precious memories through guided conversations with your loved ones
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signin">
              <FurbridgeButton variant="orange" size="lg">
                Get Started
              </FurbridgeButton>
            </Link>
            <Link href="/learn-more">
              <FurbridgeButton variant="outline" size="lg">
                Learn More
              </FurbridgeButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              How Saga Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Simple, meaningful conversations that preserve your family's legacy
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FurbridgeCard
              title="Create Your Project"
              description="Set up a family story project and invite your storyteller"
              icon="📖"
            />
            <FurbridgeCard
              title="Guided Conversations"
              description="AI-powered prompts help facilitate meaningful discussions"
              icon="💬"
            />
            <FurbridgeCard
              title="Preserve Forever"
              description="Stories are transcribed, organized, and ready to share"
              icon="💎"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Start Capturing Your Family's Story Today
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of families preserving their precious memories
          </p>
          <Link href="/auth/signin">
            <FurbridgeButton variant="orange" size="lg">
              Begin Your Journey
            </FurbridgeButton>
          </Link>
        </div>
      </section>
    </div>
  )
}
