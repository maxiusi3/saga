'use client';

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  HelpCircle, 
  MessageCircle, 
  Mail, 
  Phone,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Search,
  Book,
  CreditCard,
  Settings,
  Download,
  Users,
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'billing' | 'features' | 'technical' | 'account';
  tags: string[];
}

interface SupportContact {
  type: 'email' | 'chat' | 'phone';
  label: string;
  value: string;
  availability?: string;
  description: string;
  icon: React.ReactNode;
}

interface SubscriptionHelpCenterProps {
  className?: string;
}

export function SubscriptionHelpCenter({
  className = ''
}: SubscriptionHelpCenterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const faqItems: FAQItem[] = [
    {
      id: '1',
      question: 'How do I upgrade my subscription plan?',
      answer: 'You can upgrade your subscription plan at any time by visiting the Plans page in your project settings. Select your desired plan and follow the checkout process. Upgrades take effect immediately and you\'ll be charged a prorated amount for the current billing period.',
      category: 'billing',
      tags: ['upgrade', 'plans', 'billing']
    },
    {
      id: '2',
      question: 'What happens when my subscription expires?',
      answer: 'When your subscription expires, your project enters archival mode. You can still view and export all your stories, but you won\'t be able to record new stories or use interactive features. You can renew your subscription at any time to reactivate all features.',
      category: 'billing',
      tags: ['expiry', 'archival', 'renewal']
    },
    {
      id: '3',
      question: 'Can I cancel my subscription?',
      answer: 'Yes, you can cancel your subscription at any time. Your subscription will remain active until the end of your current billing period, after which your project will enter archival mode. You can reactivate your subscription anytime.',
      category: 'billing',
      tags: ['cancel', 'billing']
    },
    {
      id: '4',
      question: 'How many family members can I invite?',
      answer: 'The number of family members you can invite depends on your subscription plan. Each plan includes a specific number of facilitator and storyteller seats. You can view your current limits and usage in your subscription overview.',
      category: 'features',
      tags: ['invitations', 'family', 'limits']
    },
    {
      id: '5',
      question: 'What is the difference between facilitator and storyteller roles?',
      answer: 'Facilitators manage the project, invite family members, and can ask follow-up questions. Storytellers record stories and respond to prompts. Each user can only be a storyteller in one project at a time, but can be a facilitator in multiple projects.',
      category: 'features',
      tags: ['roles', 'facilitator', 'storyteller']
    },
    {
      id: '6',
      question: 'How do I export my family stories?',
      answer: 'You can export your stories from the Export page in your project dashboard. Choose your preferred format and date range, then click "Generate Export". You\'ll receive an email when your export is ready for download.',
      category: 'features',
      tags: ['export', 'download', 'stories']
    },
    {
      id: '7',
      question: 'Why can\'t I hear the audio prompts?',
      answer: 'If you can\'t hear audio prompts, check your device volume and ensure the app has audio permissions. Try refreshing the page or restarting the app. If the issue persists, contact our support team.',
      category: 'technical',
      tags: ['audio', 'prompts', 'troubleshooting']
    },
    {
      id: '8',
      question: 'How do I change my account email address?',
      answer: 'To change your account email, go to your Profile settings and update your email address. You\'ll need to verify the new email address before the change takes effect.',
      category: 'account',
      tags: ['email', 'profile', 'account']
    }
  ];

  const supportContacts: SupportContact[] = [
    {
      type: 'email',
      label: 'Email Support',
      value: 'support@saga.family',
      availability: 'Response within 24 hours',
      description: 'Get help with any questions or issues',
      icon: <Mail className="h-5 w-5" />
    },
    {
      type: 'chat',
      label: 'Live Chat',
      value: 'Start Chat',
      availability: 'Mon-Fri, 9 AM - 6 PM EST',
      description: 'Chat with our support team in real-time',
      icon: <MessageCircle className="h-5 w-5" />
    },
    {
      type: 'phone',
      label: 'Phone Support',
      value: '+1 (555) 123-4567',
      availability: 'Mon-Fri, 9 AM - 6 PM EST',
      description: 'Speak directly with our support team',
      icon: <Phone className="h-5 w-5" />
    }
  ];

  const categories = [
    { id: 'all', label: 'All Topics', icon: <Book className="h-4 w-4" /> },
    { id: 'billing', label: 'Billing & Plans', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'features', label: 'Features', icon: <Settings className="h-4 w-4" /> },
    { id: 'technical', label: 'Technical', icon: <AlertCircle className="h-4 w-4" /> },
    { id: 'account', label: 'Account', icon: <Users className="h-4 w-4" /> }
  ];

  const filteredFAQs = faqItems.filter(faq => {
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleContactSupport = (contact: SupportContact) => {
    switch (contact.type) {
      case 'email':
        window.location.href = `mailto:${contact.value}`;
        break;
      case 'chat':
        // Integrate with chat system
        console.log('Opening chat...');
        break;
      case 'phone':
        window.location.href = `tel:${contact.value}`;
        break;
    }
  };

  return (
    <div className={`max-w-4xl mx-auto space-y-8 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <HelpCircle className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Help Center</h1>
        <p className="text-lg text-gray-600">
          Find answers to common questions and get support for your Saga subscription
        </p>
      </div>

      {/* Search */}
      <Card className="p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search for help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </Card>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            variant={selectedCategory === category.id ? 'default' : 'outline'}
            size="sm"
            className="flex items-center space-x-2"
          >
            {category.icon}
            <span>{category.label}</span>
          </Button>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900">Frequently Asked Questions</h2>
        
        {filteredFAQs.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">
              Try adjusting your search terms or browse different categories
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredFAQs.map((faq) => (
              <Card key={faq.id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                  className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {faq.question}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {categories.find(c => c.id === faq.category)?.label}
                        </Badge>
                        {faq.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {expandedFAQ === faq.id ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>
                
                {expandedFAQ === faq.id && (
                  <div className="px-6 pb-6 border-t border-gray-100">
                    <div className="pt-4 text-gray-700 leading-relaxed">
                      {faq.answer}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Contact Support */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900">Contact Support</h2>
        <p className="text-gray-600">
          Can't find what you're looking for? Our support team is here to help.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {supportContacts.map((contact) => (
            <Card key={contact.type} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  {contact.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {contact.label}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {contact.description}
                  </p>
                  {contact.availability && (
                    <div className="flex items-center text-xs text-gray-500 mb-3">
                      <Clock className="h-3 w-3 mr-1" />
                      {contact.availability}
                    </div>
                  )}
                  <Button
                    onClick={() => handleContactSupport(contact)}
                    size="sm"
                    className="w-full"
                  >
                    {contact.value}
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/dashboard/subscription/plans"
            className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <CreditCard className="h-5 w-5 text-blue-600 mr-3" />
            <div>
              <div className="font-medium text-gray-900">View Plans & Pricing</div>
              <div className="text-sm text-gray-600">Compare subscription options</div>
            </div>
          </a>
          
          <a
            href="/dashboard/profile"
            className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Users className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <div className="font-medium text-gray-900">Account Settings</div>
              <div className="text-sm text-gray-600">Manage your profile and preferences</div>
            </div>
          </a>
          
          <a
            href="/dashboard/exports"
            className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-5 w-5 text-purple-600 mr-3" />
            <div>
              <div className="font-medium text-gray-900">Export Stories</div>
              <div className="text-sm text-gray-600">Download your family stories</div>
            </div>
          </a>
          
          <a
            href="https://docs.saga.family"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Book className="h-5 w-5 text-orange-600 mr-3" />
            <div>
              <div className="font-medium text-gray-900">Documentation</div>
              <div className="text-sm text-gray-600">Detailed guides and tutorials</div>
            </div>
            <ExternalLink className="h-4 w-4 text-gray-400 ml-auto" />
          </a>
        </div>
      </Card>

      {/* Status Page */}
      <Card className="p-6 bg-green-50 border-green-200">
        <div className="flex items-center space-x-3">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-900">All Systems Operational</h3>
            <p className="text-sm text-green-800">
              All Saga services are running normally. 
              <a 
                href="https://status.saga.family" 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-1 underline hover:no-underline"
              >
                View status page
              </a>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default SubscriptionHelpCenter;