import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'

export default function LearnMorePage() {
  const features = [
    {
      title: 'AI-Powered Prompts',
      description: 'Thoughtfully crafted questions that help guide meaningful conversations and unlock precious memories.'
    },
    {
      title: 'Automatic Transcription',
      description: 'Every story is automatically transcribed with high accuracy, making them searchable and easy to share.'
    },
    {
      title: 'Family Collaboration',
      description: 'Invite multiple family members to participate, ask follow-up questions, and add their own memories.'
    },
    {
      title: 'Secure & Private',
      description: 'Your family stories are kept private and secure, accessible only to invited family members.'
    },
    {
      title: 'Multiple Export Options',
      description: 'Export your complete family archive in various formats for safekeeping and sharing.'
    },
    {
      title: 'Mobile Friendly',
      description: 'Easy-to-use interface designed for storytellers of all ages and technical comfort levels.'
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Preserve Your Family's Legacy
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Saga makes it simple to capture, organize, and preserve your family's most precious stories 
            through guided conversations that bring generations together.
          </p>
          <Link href="/auth/signin">
            <FurbridgeButton variant="orange" size="lg">
              Start Your Family's Saga
            </FurbridgeButton>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need to Capture Family Stories
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform is designed to make storytelling natural, meaningful, and accessible for everyone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FurbridgeCard key={index} className="p-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </FurbridgeCard>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How Saga Works
            </h2>
            <p className="text-xl text-gray-600">
              Three simple steps to start preserving your family's stories
            </p>
          </div>

          <div className="space-y-12">
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center text-xl font-bold">
                  1
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Create Your Project
                </h3>
                <p className="text-gray-600">
                  Set up a family story project and invite your storyteller. Our platform guides you through 
                  the setup process and helps you get started with meaningful prompts.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center text-xl font-bold">
                  2
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Record Stories
                </h3>
                <p className="text-gray-600">
                  Your storyteller uses our simple recording interface to share their memories. 
                  AI-powered prompts help guide the conversation and unlock precious stories.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center text-xl font-bold">
                  3
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Preserve & Share
                </h3>
                <p className="text-gray-600">
                  Stories are automatically transcribed and organized. Family members can listen, 
                  comment, ask follow-up questions, and export the complete archive.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Ready to Start Your Family's Story?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join families around the world who are preserving their precious memories with Saga.
          </p>
          <Link href="/auth/signin">
            <FurbridgeButton variant="orange" size="lg">
              Get Started Today
            </FurbridgeButton>
          </Link>
        </div>
      </section>
    </div>
  )
}
