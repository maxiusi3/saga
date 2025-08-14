'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { 
  HelpCircle, 
  MessageCircle, 
  Mail, 
  Phone,
  ExternalLink,
  Book,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface SubscriptionSupportProps {
  className?: string;
}

export function SubscriptionSupport({
  className = ''
}: SubscriptionSupportProps) {
  const handleContactSupport = (type: 'email' | 'chat' | 'phone') => {
    switch (type) {
      case 'email':
        window.location.href = 'mailto:support@saga.family';
        break;
      case 'chat':
        // Integrate with chat system
        console.log('Opening chat...');
        break;
      case 'phone':
        window.location.href = 'tel:+15551234567';
        break;
    }
  };

  const quickHelp = [
    {
      question: 'How do I upgrade my plan?',
      answer: 'Visit the Plans page and select your desired plan. Upgrades take effect immediately.',
      action: { label: 'View Plans', href: './plans' }
    },
    {
      question: 'What happens when my subscription expires?',
      answer: 'Your project enters archival mode. You can still view and export stories.',
      action: { label: 'Learn More', href: './help' }
    },
    {
      question: 'How do I cancel my subscription?',
      answer: 'You can cancel anytime. Your subscription remains active until the end of the billing period.',
      action: { label: 'Cancel Subscription', href: './cancel' }
    }
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <HelpCircle className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Need Help?</h2>
        <p className="text-gray-600">
          Get support for your subscription and account
        </p>
      </div>

      {/* Quick Help */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Answers</h3>
        <div className="space-y-4">
          {quickHelp.map((item, index) => (
            <div key={index} className="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
              <h4 className="font-medium text-gray-900 mb-2">{item.question}</h4>
              <p className="text-sm text-gray-600 mb-3">{item.answer}</p>
              <Button
                onClick={() => window.location.href = item.action.href}
                variant="outline"
                size="sm"
              >
                {item.action.label}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Contact Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleContactSupport('email')}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Email Support</h3>
              <p className="text-sm text-gray-600">Response within 24 hours</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleContactSupport('chat')}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MessageCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Live Chat</h3>
              <p className="text-sm text-gray-600">Mon-Fri, 9 AM - 6 PM EST</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleContactSupport('phone')}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Phone className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Phone Support</h3>
              <p className="text-sm text-gray-600">Mon-Fri, 9 AM - 6 PM EST</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Additional Resources */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="./help"
            className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Book className="h-5 w-5 text-blue-600 mr-3" />
            <div>
              <div className="font-medium text-gray-900">Help Center</div>
              <div className="text-sm text-gray-600">Browse FAQs and guides</div>
            </div>
          </a>
          
          <a
            href="https://docs.saga.family"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <div className="font-medium text-gray-900">Documentation</div>
              <div className="text-sm text-gray-600">Detailed user guides</div>
            </div>
          </a>
        </div>
      </Card>

      {/* System Status */}
      <Card className="p-4 bg-green-50 border-green-200">
        <div className="flex items-center space-x-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <h3 className="font-medium text-green-900">All Systems Operational</h3>
            <p className="text-sm text-green-800">
              All Saga services are running normally.
              <a 
                href="https://status.saga.family" 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-1 underline hover:no-underline"
              >
                View status
              </a>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default SubscriptionSupport;