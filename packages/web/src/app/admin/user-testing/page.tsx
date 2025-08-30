'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface TestingProgress {
  totalTesters: number;
  activeTesters: number;
  completedSessions: number;
  pendingSessions: number;
  averageRating: number;
  completionRate: number;
  criticalIssues: number;
  resolvedIssues: number;
  lastUpdated: Date;
}

interface UsabilityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'navigation' | 'accessibility' | 'performance' | 'content' | 'functionality';
  description: string;
}

// Component continues here
function StepsSection({ scenario }: { scenario: any }) {
  return (
    <div>
      <h4 className="font-medium mb-2">Steps ({scenario.steps.length})</h4>
      <div className="space-y-2">
        {scenario.steps.slice(0, 3).map((step: any, index: number) => (
          <div key={index} className="text-sm text-gray-600">
            <span className="font-medium">{step.stepNumber}.</span> {step.instruction}
          </div>
        ))}
        {scenario.steps.length > 3 && (
          <div className="text-sm text-gray-500">
            +{scenario.steps.length - 3} more steps...
          </div>
        )}
      </div>
    </div>
  )
}

function SuccessCriteriaSection({ scenario }: { scenario: any }) {
  return (
    <div>
      <h4 className="font-medium mb-2">Success Criteria</h4>
      <div className="space-y-1">
        {scenario.successCriteria.slice(0, 2).map((criteria: any, index: number) => (
          <div key={index} className="text-sm text-gray-600">
            • {criteria}
          </div>
        ))}
        {scenario.successCriteria.length > 2 && (
          <div className="text-sm text-gray-500">
            +{scenario.successCriteria.length - 2} more criteria...
          </div>
        )}
      </div>
    </div>
  )
}

export default function UserTestingPage() {
  const [activeTab, setActiveTab] = useState('scenarios')
  const [scenarios, setScenarios] = useState<any[]>([])
  const [issues, setIssues] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">User Testing Dashboard</h1>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'scenarios'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Test Scenarios
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'issues'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Issues
          </button>
        </nav>
      </div>

      {/* Scenarios Tab */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          <div className="text-center py-12">
            <p className="text-gray-500">User testing scenarios will be displayed here.</p>
          </div>
        </div>
      )}

      {/* Issues Tab */}
      {activeTab === 'issues' && (
        <div className="space-y-6">
          <div className="text-center py-12">
            <p className="text-gray-500">Usability issues will be displayed here.</p>
          </div>
        </div>
      )}
    </div>
  )
}
