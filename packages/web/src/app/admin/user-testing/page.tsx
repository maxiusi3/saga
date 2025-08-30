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
  desc     
               <h4 className="font-medium mb-2">Steps ({scenario.steps.length})</h4>
                    <div className="space-y-2">
                      {scenario.steps.slice(0, 3).map((step, index) => (
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
                  
                  <div>
                    <h4 className="font-medium mb-2">Success Criteria</h4>
                    <div className="space-y-1">
                      {scenario.successCriteria.slice(0, 2).map((criteria, index) => (
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
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Issues Tab */}
      {activeTab === 'issues' && issues && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Usability Issues</h2>
            <div className="flex space-x-2">
              <Badge variant="outline" className="bg-red-50">
                {issues.critical.length} Critical
              </Badge>
              <Badge variant="outline" className="bg-orange-50">
                {issues.high.length} High
              </Badge>
              <Badge variant="outline" className="bg-yellow-50">
                {issues.medium.length} Medium
              </Badge>
              <Badge variant="outline" className="bg-green-50">
                {issues.low.length} Low
              </Badge>
            </div>
          </div>

          {/* Issue Categories */}
          {Object.entries(issues).map(([severity, issueList]) => (
            issueList.length > 0 && (
              <Card key={severity} className="p-6">
                <div className="flex items-center mb-4">
                  <div className={`w-3 h-3 rounded-full mr-2 ${getSeverityColor(severity)}`}></div>
                  <h3 className="text-lg font-semibold capitalize">{severity} Issues ({issueList.length})</h3>
                </div>
                
                <div className="space-y-4">
                  {issueList.map((issue, index) => (
                    <div key={index} className="border-l-4 border-gray-200 pl-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{issue.description}</h4>
                        <Badge variant="outline" className="capitalize">
                          {issue.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Location:</span> {issue.location}
                      </p>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Reproduction:</span>
                        <ol className="list-decimal list-inside mt-1 ml-4">
                          {issue.reproductionSteps.map((step, stepIndex) => (
                            <li key={stepIndex}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          ))}
        </div>
      )}

      {/* Recruitment Tab */}
      {activeTab === 'recruitment' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Beta Tester Recruitment</h2>
            <Button onClick={startRecruitment}>
              Start New Campaign
            </Button>
          </div>

          {/* Recruitment Form */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Campaign Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Target Count</label>
                <input
                  type="number"
                  defaultValue={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Family Size Range</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    defaultValue={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="self-center">to</span>
                  <input
                    type="number"
                    defaultValue={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">Age Ranges</label>
              <div className="flex flex-wrap gap-2">
                {['45-55', '55-65', '65-75', '75+'].map((range) => (
                  <label key={range} className="flex items-center">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="mr-2"
                    />
                    <span className="text-sm">{range}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">Tech Comfort Levels</label>
              <div className="flex flex-wrap gap-2">
                {['Low', 'Medium', 'High'].map((level) => (
                  <label key={level} className="flex items-center">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="mr-2"
                    />
                    <span className="text-sm">{level}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">Device Types</label>
              <div className="flex flex-wrap gap-2">
                {['iOS', 'Android', 'Both'].map((device) => (
                  <label key={device} className="flex items-center">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="mr-2"
                    />
                    <span className="text-sm">{device}</span>
                  </label>
                ))}
              </div>
            </div>
          </Card>

          {/* Current Campaigns */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Active Campaigns</h3>
            <div className="text-gray-600">
              No active recruitment campaigns at this time.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}