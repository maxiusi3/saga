'use client'

import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Mic, Play, HelpCircle, MessageCircle, Phone } from 'lucide-react'

export default function StorytellerHelpPage() {
  const tips = [
    {
      icon: <Mic className="h-6 w-6 text-furbridge-orange" />,
      title: 'Recording Tips',
      content: 'Find a quiet space, speak clearly, and don\'t worry about being perfect. Your authentic voice is what matters most.'
    },
    {
      icon: <Play className="h-6 w-6 text-furbridge-teal" />,
      title: 'Getting Started',
      content: 'Start with simple memories and let the conversation flow naturally. The prompts are there to guide you, not limit you.'
    },
    {
      icon: <HelpCircle className="h-6 w-6 text-furbridge-warm-gray" />,
      title: 'Need Help?',
      content: 'If you get stuck or have questions, don\'t hesitate to ask your facilitator or contact our support team.'
    }
  ]

  const faqs = [
    {
      question: 'How do I start recording my first story?',
      answer: 'Simply tap the "Record" button and start speaking. The app will guide you with prompts, but feel free to share whatever comes to mind. You can pause anytime if you need a break.'
    },
    {
      question: 'What if I make a mistake while recording?',
      answer: 'Don\'t worry about mistakes! You can pause, take a breath, and continue. Small mistakes make your story more authentic and human. You can always re-record if needed.'
    },
    {
      question: 'How long should my stories be?',
      answer: 'There\'s no perfect length. Some stories might be 2 minutes, others might be 20 minutes. Share as much or as little as feels right for each memory.'
    },
    {
      question: 'What if I can\'t think of what to say?',
      answer: 'The app provides helpful prompts to get you started. Think about specific moments, people, or places. Even small details can spark bigger memories.'
    },
    {
      question: 'Who can hear my stories?',
      answer: 'Only the family members invited to your project can hear your stories. Your memories are private and secure.'
    },
    {
      question: 'Can I listen to my stories after recording?',
      answer: 'Yes! You can listen to all your recorded stories anytime. Your family members can also listen, leave comments, and ask follow-up questions.'
    }
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Storyteller Guide</h1>
        <p className="text-lg text-muted-foreground">
          Everything you need to know about sharing your stories
        </p>
      </div>

      {/* Quick Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tips.map((tip, index) => (
          <FurbridgeCard key={index} className="p-6 text-center">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-muted/50 rounded-lg flex items-center justify-center mx-auto">
                {tip.icon}
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">{tip.title}</h3>
                <p className="text-sm text-muted-foreground">{tip.content}</p>
              </div>
            </div>
          </FurbridgeCard>
        ))}
      </div>

      {/* Getting Started Guide */}
      <FurbridgeCard className="p-8">
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Getting Started</h2>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-furbridge-orange text-white rounded-full flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div>
                <h3 className="font-medium text-foreground">Choose a Comfortable Space</h3>
                <p className="text-sm text-muted-foreground">
                  Find a quiet, comfortable place where you won't be interrupted. This could be your favorite chair, the kitchen table, or anywhere you feel relaxed.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-furbridge-orange text-white rounded-full flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <div>
                <h3 className="font-medium text-foreground">Read the Prompt</h3>
                <p className="text-sm text-muted-foreground">
                  Each recording session starts with a prompt to help guide your story. Take a moment to think about the question before you start recording.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-furbridge-orange text-white rounded-full flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div>
                <h3 className="font-medium text-foreground">Start Recording</h3>
                <p className="text-sm text-muted-foreground">
                  Press the record button and start sharing your memory. Speak naturally, as if you're talking to a close friend or family member.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-furbridge-orange text-white rounded-full flex items-center justify-center text-sm font-semibold">
                4
              </div>
              <div>
                <h3 className="font-medium text-foreground">Take Your Time</h3>
                <p className="text-sm text-muted-foreground">
                  You can pause anytime to collect your thoughts. There's no rush - the most important thing is sharing your authentic story.
                </p>
              </div>
            </div>
          </div>
        </div>
      </FurbridgeCard>

      {/* FAQ Section */}
      <FurbridgeCard className="p-6">
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Common Questions</h2>

          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={index.toString()} className="border border-border rounded-lg px-4">
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="font-medium text-foreground">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pt-2 pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </FurbridgeCard>

      {/* Encouragement Section */}
      <FurbridgeCard className="p-8 bg-gradient-to-r from-furbridge-orange/5 to-furbridge-teal/5">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Remember</h3>
          <p className="text-muted-foreground italic max-w-2xl mx-auto">
            "Your stories are precious gifts to your family. Every memory you share, 
            no matter how small it might seem to you, becomes a treasure for future generations. 
            Your voice, your experiences, and your wisdom are irreplaceable."
          </p>
        </div>
      </FurbridgeCard>

      {/* Contact Support */}
      <FurbridgeCard className="p-6 text-center">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Need More Help?</h3>
          <p className="text-muted-foreground">
            Our support team is here to help you every step of the way.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <FurbridgeButton variant="orange">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat with Support
            </FurbridgeButton>
            <FurbridgeButton variant="outline">
              <Phone className="h-4 w-4 mr-2" />
              Call Support
            </FurbridgeButton>
          </div>
        </div>
      </FurbridgeCard>
    </div>
  )
}
