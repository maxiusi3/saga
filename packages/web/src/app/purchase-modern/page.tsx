'use client'

import { useState } from "react"
import { EnhancedButton } from "@/components/ui/enhanced-button"
import { PricingCard } from "@/components/ui/pricing-card"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from "@/components/ui/enhanced-card"
import { StatsCard } from "@/components/ui/stats-card"
import { Play, Check, Star, Shield, Clock, Users, BookOpen, Headphones, Download, Globe, Lock, CreditCard } from "lucide-react"
import Image from "next/image"

export default function PurchaseModernPage() {
  const [selectedPlan, setSelectedPlan] = useState('family-saga')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  })

  const features = [
    { text: "1 Project Voucher", included: true, highlight: true },
    { text: "2 Facilitator Seats", included: true, highlight: true },
    { text: "2 Storyteller Seats", included: true, highlight: true },
    { text: "1 Year Interactive Service", included: true },
    { text: "Unlimited Story Recording", included: true },
    { text: "AI-Powered Prompts", included: true },
    { text: "Automatic Transcription", included: true },
    { text: "Family Collaboration Tools", included: true },
    { text: "Multiple Export Formats", included: true },
    { text: "Permanent Archive Access", included: true },
    { text: "Priority Customer Support", included: true },
    { text: "Mobile & Web Access", included: true }
  ]

  const benefits = [
    {
      icon: <Users className="w-6 h-6" />,
      title: "Lifetime Access",
      description: "Your stories are captured forever and can be accessed by your family for generations to come."
    },
    {
      icon: <BookOpen className="w-6 h-6" />,
      title: "Simple and Intuitive",
      description: "Designed specifically for older adults with an easy-to-use interface that anyone can master."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "100% Secure",
      description: "Your family stories are kept private and secure, accessible only to invited family members."
    }
  ]

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Daughter",
      content: "Saga helped us capture my mother's incredible life story. The AI prompts made it so easy for her to share memories she hadn't talked about in years.",
      rating: 5
    },
    {
      name: "Michael Chen", 
      role: "Son",
      content: "The transcription quality is amazing, and being able to collaborate with my siblings to ask follow-up questions made this such a rich experience.",
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">Saga</h1>
                <p className="text-xs text-muted-foreground">Back to Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <EnhancedButton variant="outline" size="sm">
                Preview
              </EnhancedButton>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Preserve Your Family Stories Forever
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Create lasting digital heirlooms from your family's unique stories through guided conversations and AI-powered storytelling tools.
          </p>
          
          {/* Demo Video/Image */}
          <div className="relative max-w-4xl mx-auto mb-12">
            <div className="aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl border border-primary/20 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="h-8 w-8 text-white ml-1" />
                </div>
                <p className="text-muted-foreground">Watch how Saga helps families preserve their stories</p>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {benefits.map((benefit, index) => (
            <EnhancedCard key={index} variant="default" className="text-center hover:shadow-lg transition-all duration-300">
              <EnhancedCardContent className="p-8">
                <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <div className="text-primary">
                    {benefit.icon}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </EnhancedCardContent>
            </EnhancedCard>
          ))}
        </div>

        {/* Pricing Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Family Saga Package
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Everything you need to capture, preserve, and share your family's stories
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-16">
          <PricingCard
            title="Complete Family Saga Package"
            subtitle="Perfect for families ready to preserve their legacy"
            price={{
              amount: 209,
              currency: "$",
              originalAmount: 299
            }}
            badge={{
              text: "BEST VALUE",
              variant: "success"
            }}
            features={features}
            ctaText="Start Your Family Saga"
            popular={true}
            onCTAClick={() => console.log('Purchase clicked')}
          />
        </div>

        {/* Purchase Form */}
        <div className="max-w-2xl mx-auto mb-16">
          <EnhancedCard>
            <EnhancedCardHeader>
              <EnhancedCardTitle className="text-center">Complete Your Purchase</EnhancedCardTitle>
              <p className="text-center text-muted-foreground">
                Secure checkout powered by Stripe
              </p>
            </EnhancedCardHeader>
            <EnhancedCardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className="w-full p-3 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter your first name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className="w-full p-3 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter your last name"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full p-3 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your email address"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-3 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your phone number"
                />
              </div>

              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-medium text-foreground">Total</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-foreground">$209</div>
                    <div className="text-sm text-muted-foreground line-through">$299</div>
                  </div>
                </div>
                
                <EnhancedButton
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                  leftIcon={<CreditCard className="h-5 w-5" />}
                >
                  Complete Purchase
                </EnhancedButton>
                
                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    <span>Secure Payment</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    <span>SSL Encrypted</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    <span>30-Day Guarantee</span>
                  </div>
                </div>
              </div>
            </EnhancedCardContent>
          </EnhancedCard>
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            What Families Are Saying
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <EnhancedCard key={index} variant="default" className="hover:shadow-lg transition-all duration-300">
                <EnhancedCardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-foreground mb-4 leading-relaxed">
                    "{testimonial.content}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {testimonial.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {testimonial.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role}
                      </div>
                    </div>
                  </div>
                </EnhancedCardContent>
              </EnhancedCard>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">
                  How does the AI-powered storytelling work?
                </h3>
                <p className="text-muted-foreground">
                  Our AI generates thoughtful prompts based on your family's unique story, helping guide conversations and unlock memories that might otherwise be forgotten.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>
            
            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">
                  What happens after the first year?
                </h3>
                <p className="text-muted-foreground">
                  After your first year, your stories remain permanently accessible in archive mode. You can still view, share, and export all content, with optional renewal for continued interactive features.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>
            
            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">
                  Is my family's data secure?
                </h3>
                <p className="text-muted-foreground">
                  Absolutely. We use enterprise-grade encryption and security measures. Your stories are private to your family and are never shared or used for any other purpose.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-5 w-5 text-success" />
              <span>30-Day Money Back Guarantee</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-5 w-5 text-success" />
              <span>Bank-Level Security</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-5 w-5 text-success" />
              <span>1000+ Happy Families</span>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Need Help? Contact our support team at{" "}
            <a href="mailto:support@saga.family" className="text-primary hover:underline">
              support@saga.family
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}