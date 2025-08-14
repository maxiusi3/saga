'use client'

import { useEffect, useState } from 'react'
import { formatRelativeTime } from '@/lib/utils'

interface FacilitatorActivity {
  id: string
  type: 'interaction_added' | 'transcript_updated' | 'story_uploaded'
  facilitatorName: string
  facilitatorId: string
  storyTitle?: string
  storyId?: string
  content?: string
  timestamp: string
}

interface FacilitatorActivityFeedProps {
  projectId: string
  activities: FacilitatorActivity[]
  className?: string
}

export function FacilitatorActivityFeed({ 
  projectId, 
  activities, 
  className = '' 
}: FacilitatorActivityFeedProps) {
  const [displayActivities, setDisplayActivities] = useState<FacilitatorActivity[]>([])

  useEffect(() => {
    // Sort activities by timestamp (most recent first) and limit to recent ones
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10) // Show only last 10 activities

    setDisplayActivities(sortedActivities)
  }, [activities])

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'interaction_added':
        return (
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        )
      case 'transcript_updated':
        return (
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        )
      case 'story_uploaded':
        return (
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
    }
  }

  const getActivityDescription = (activity: FacilitatorActivity) => {
    switch (activity.type) {
      case 'interaction_added':
        return (
          <span>
            <span className="font-medium text-gray-900">{activity.facilitatorName}</span>
            {' '}added a comment to{' '}
            <span className="font-medium text-gray-900">"{activity.storyTitle}"</span>
          </span>
        )
      case 'transcript_updated':
        return (
          <span>
            <span className="font-medium text-gray-900">{activity.facilitatorName}</span>
            {' '}updated the transcript for{' '}
            <span className="font-medium text-gray-900">"{activity.storyTitle}"</span>
          </span>
        )
      case 'story_uploaded':
        return (
          <span>
            <span className="font-medium text-gray-900">{activity.facilitatorName}</span>
            {' '}uploaded a new story{' '}
            <span className="font-medium text-gray-900">"{activity.storyTitle}"</span>
          </span>
        )
      default:
        return (
          <span>
            <span className="font-medium text-gray-900">{activity.facilitatorName}</span>
            {' '}performed an action
          </span>
        )
    }
  }

  if (displayActivities.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow ${className}`}>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="text-center py-6">
            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No recent activity</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
        <div className="flow-root">
          <ul className="-mb-8">
            {displayActivities.map((activity, activityIdx) => (
              <li key={activity.id}>
                <div className="relative pb-8">
                  {activityIdx !== displayActivities.length - 1 ? (
                    <span
                      className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div>{getActivityIcon(activity.type)}</div>
                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                      <div>
                        <p className="text-sm text-gray-500">
                          {getActivityDescription(activity)}
                        </p>
                        {activity.content && (
                          <p className="mt-1 text-sm text-gray-600 italic">
                            "{activity.content.length > 100 
                              ? `${activity.content.substring(0, 100)}...` 
                              : activity.content}"
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm whitespace-nowrap text-gray-500">
                        {formatRelativeTime(activity.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}