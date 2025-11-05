'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Search, MessageCircle, Book, Video, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface FAQItem {
  id: string
  question: string
  answer: string
  category: 'getting-started' | 'recording' | 'sharing' | 'technical' | 'billing'
}

export default function HelpPage() {
  const t = useTranslations('help')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const faqItems: FAQItem[] = [
    {
      id: '1',
      question: t('faqs.createProject.question'),
      answer: t('faqs.createProject.answer'),
      category: 'getting-started'
    },
    {
      id: '2',
      question: t('faqs.inviteMembers.question'),
      answer: t('faqs.inviteMembers.answer'),
      category: 'sharing'
    },
    {
      id: '3',
      question: t('faqs.recordStories.question'),
      answer: t('faqs.recordStories.answer'),
      category: 'recording'
    },
    {
      id: '4',
      question: t('faqs.transcription.question'),
      answer: t('faqs.transcription.answer'),
      category: 'technical'
    },
    {
      id: '5',
      question: t('faqs.exportStories.question'),
      answer: t('faqs.exportStories.answer'),
      category: 'technical'
    },
    {
      id: '6',
      question: t('faqs.moreSeats.question'),
      answer: t('faqs.moreSeats.answer'),
      category: 'billing'
    },
    {
      id: '7',
      question: t('faqs.helpElderly.question'),
      answer: t('faqs.helpElderly.answer'),
      category: 'getting-started'
    },
    {
      id: '8',
      question: t('faqs.privacy.question'),
      answer: t('faqs.privacy.answer'),
      category: 'technical'
    }
  ]

  const categories = [
    { id: 'all', label: t('categories.all'), count: faqItems.length },
    { id: 'getting-started', label: t('categories.gettingStarted'), count: faqItems.filter(item => item.category === 'getting-started').length },
    { id: 'recording', label: t('categories.recording'), count: faqItems.filter(item => item.category === 'recording').length },
    { id: 'sharing', label: t('categories.sharing'), count: faqItems.filter(item => item.category === 'sharing').length },
    { id: 'technical', label: t('categories.technical'), count: faqItems.filter(item => item.category === 'technical').length },
    { id: 'billing', label: t('categories.billing'), count: faqItems.filter(item => item.category === 'billing').length }
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
        <h1 className="text-4xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-xl text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 text-lg"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('quickActions.videoTutorials.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('quickActions.videoTutorials.description')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('quickActions.liveChat.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('quickActions.liveChat.description')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto">
              <Mail className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('quickActions.emailSupport.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('quickActions.emailSupport.description')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.label}
            <Badge variant="secondary" className="ml-2 text-xs">
              {category.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* FAQ Section */}
      <Card className="p-6">
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">
            {t('faqTitle')}
          </h2>

          {filteredFAQs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {t('noResults')}
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
      </Card>

      {/* Contact Section */}
      <Card className="p-8 text-center">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">
            {t('contact.title')}
          </h3>
          <p className="text-muted-foreground">
            {t('contact.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button>
              <MessageCircle className="h-4 w-4 mr-2" />
              {t('contact.startChat')}
            </Button>
            <Button variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              {t('contact.emailUs')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
