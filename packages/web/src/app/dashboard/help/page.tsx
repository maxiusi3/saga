'use client'

import { useState } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Search, MessageCircle, Book, Video, Mail } from 'lucide-react'

interface FAQItem {
  id: string
  question: string
  answer: string
  category: 'getting-started' | 'recording' | 'sharing' | 'technical' | 'billing'
}

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const faqItems: FAQItem[] = [
    {
      id: '1',
      question: 'How do I create my first family story project?',
      answer: 'To create your first project, click "Create a New Saga" from your dashboard. You\'ll need to purchase a Saga Package first, which includes everything you need to get started. After purchase, you can set up your project and invite a storyteller.',
      category: 'getting-started'
    },
    {
      id: '2',
      question: 'How do I invite family members to participate?',
      answer: 'From your project settings, you can invite storytellers and co-facilitators. Click "Invite Storyteller" or "Invite Co-Facilitator" and enter their email address. They\'ll receive an invitation link to join your project.',
      category: 'sharing'
    },
    {
      id: '3',
      question: 'What\'s the best way to record stories?',
      answer: 'Find a quiet space with minimal background noise. Use the built-in prompts to guide conversations, and don\'t worry about perfect recordings - authenticity is more important than perfection. You can pause and resume recordings anytime.',
      category: 'recording'
    },
    {
      id: '4',
      question: 'How does the transcription work?',
      answer: 'All audio recordings are automatically transcribed using advanced AI technology. Transcripts are usually ready within a few minutes of uploading. You can edit transcripts if needed to correct any errors.',
      category: 'technical'
    },
    {
      id: '5',
      question: 'Can I export my family stories?',
      answer: 'Yes! You can export your complete story archive from the project settings. This includes all audio files, transcripts, photos, and comments in a downloadable format.',
      category: 'technical'
    },
    {
      id: '6',
      question: 'What happens if I need more seats?',
      answer: 'You can purchase additional seats anytime from your resource management page. Extra project vouchers cost $15, facilitator seats cost $10, and storyteller seats cost $5.',
      category: 'billing'
    },
    {
      id: '7',
      question: 'How do I help my elderly family member use the app?',
      answer: 'The storyteller interface is designed to be simple and intuitive. Consider doing a practice session together, and remember that family members only need to focus on recording - you handle all the project management as the facilitator.',
      category: 'getting-started'
    },
    {
      id: '8',
      question: 'Are my family stories private and secure?',
      answer: 'Yes, all stories are private by default and only accessible to invited family members. We use enterprise-grade security and encryption to protect your precious memories.',
      category: 'technical'
    }
  ]

  const categories = [
    { id: 'all', label: 'All Topics', count: faqItems.length },
    { id: 'getting-started', label: 'Getting Started', count: faqItems.filter(item => item.category === 'getting-started').length },
    { id: 'recording', label: 'Recording Stories', count: faqItems.filter(item => item.category === 'recording').length },
    { id: 'sharing', label: 'Sharing & Collaboration', count: faqItems.filter(item => item.category === 'sharing').length },
    { id: 'technical', label: 'Technical', count: faqItems.filter(item => item.category === 'technical').length },
    { id: 'billing', label: 'Billing & Pricing', count: faqItems.filter(item => item.category === 'billing').length }
  ]

  const filteredFAQs = faqItems.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">Help Center</h1>
        <p className="text-xl text-muted-foreground">
          Find answers to common questions and get support
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search for help..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 text-lg"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FurbridgeCard className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-furbridge-orange/10 rounded-lg flex items-center justify-center mx-auto">
              <Video className="h-6 w-6 text-furbridge-orange" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Video Tutorials</h3>
              <p className="text-sm text-muted-foreground">
                Step-by-step guides to get you started
              </p>
            </div>
          </div>
        </FurbridgeCard>

        <FurbridgeCard className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-furbridge-teal/10 rounded-lg flex items-center justify-center mx-auto">
              <MessageCircle className="h-6 w-6 text-furbridge-teal" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Live Chat</h3>
              <p className="text-sm text-muted-foreground">
                Get instant help from our support team
              </p>
            </div>
          </div>
        </FurbridgeCard>

        <FurbridgeCard className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-furbridge-warm-gray/10 rounded-lg flex items-center justify-center mx-auto">
              <Mail className="h-6 w-6 text-furbridge-warm-gray" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Email Support</h3>
              <p className="text-sm text-muted-foreground">
                Send us a message and we'll respond within 24 hours
              </p>
            </div>
          </div>
        </FurbridgeCard>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <FurbridgeButton
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
            className={selectedCategory === category.id ? "bg-furbridge-orange text-white" : ""}
          >
            {category.label}
            <Badge variant="secondary" className="ml-2 text-xs">
              {category.count}
            </Badge>
          </FurbridgeButton>
        ))}
      </div>

      {/* FAQ Section */}
      <FurbridgeCard className="p-6">
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">
            Frequently Asked Questions
          </h2>

          {filteredFAQs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No questions found matching your search.
              </p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {filteredFAQs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id} className="border border-border rounded-lg px-4">
                  <AccordionTrigger className="text-left hover:no-underline">
                    <div className="flex items-start space-x-3">
                      <Badge variant="outline" className="text-xs mt-1">
                        {categories.find(cat => cat.id === faq.category)?.label}
                      </Badge>
                      <span className="font-medium text-foreground">
                        {faq.question}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pt-2 pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </FurbridgeCard>

      {/* Contact Section */}
      <FurbridgeCard className="p-8 text-center">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">
            Still need help?
          </h3>
          <p className="text-muted-foreground">
            Our support team is here to help you preserve your family's precious stories.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <FurbridgeButton variant="orange">
              <MessageCircle className="h-4 w-4 mr-2" />
              Start Live Chat
            </FurbridgeButton>
            <FurbridgeButton variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Email Support
            </FurbridgeButton>
          </div>
        </div>
      </FurbridgeCard>
    </div>
  )
}
