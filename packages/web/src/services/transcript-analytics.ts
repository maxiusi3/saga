/**
 * Analytics service for tracking transcript editing activities
 */

interface TranscriptEditEvent {
  storyId: string
  projectId: string
  userId: string
  userName: string
  originalLength: number
  editedLength: number
  editDuration: number // in seconds
  editType: 'manual' | 'auto_save'
  timestamp: Date
}

interface TranscriptEditSession {
  storyId: string
  userId: string
  startTime: Date
  endTime?: Date
  editCount: number
  finalLength: number
  wasCompleted: boolean
}

class TranscriptAnalyticsService {
  private events: TranscriptEditEvent[] = []
  private sessions: Map<string, TranscriptEditSession> = new Map()

  /**
   * Track when a user starts editing a transcript
   */
  trackEditStart(storyId: string, projectId: string, userId: string, userName: string): void {
    const sessionKey = `${storyId}-${userId}`
    
    this.sessions.set(sessionKey, {
      storyId,
      userId,
      startTime: new Date(),
      editCount: 0,
      finalLength: 0,
      wasCompleted: false,
    })

    // Send to analytics service
    this.sendAnalyticsEvent('transcript_edit_started', {
      story_id: storyId,
      project_id: projectId,
      user_id: userId,
      user_name: userName,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Track when a transcript is saved (manual or auto-save)
   */
  trackEditSave(
    storyId: string,
    projectId: string,
    userId: string,
    userName: string,
    originalLength: number,
    editedLength: number,
    editType: 'manual' | 'auto_save'
  ): void {
    const sessionKey = `${storyId}-${userId}`
    const session = this.sessions.get(sessionKey)
    
    if (session) {
      session.editCount++
      session.finalLength = editedLength
    }

    const editDuration = session 
      ? (new Date().getTime() - session.startTime.getTime()) / 1000
      : 0

    const event: TranscriptEditEvent = {
      storyId,
      projectId,
      userId,
      userName,
      originalLength,
      editedLength,
      editDuration,
      editType,
      timestamp: new Date(),
    }

    this.events.push(event)

    // Send to analytics service
    this.sendAnalyticsEvent('transcript_edited', {
      story_id: storyId,
      project_id: projectId,
      user_id: userId,
      user_name: userName,
      original_length: originalLength,
      edited_length: editedLength,
      length_change: editedLength - originalLength,
      edit_duration: editDuration,
      edit_type: editType,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Track when a user completes editing (saves and exits)
   */
  trackEditComplete(storyId: string, userId: string): void {
    const sessionKey = `${storyId}-${userId}`
    const session = this.sessions.get(sessionKey)
    
    if (session) {
      session.endTime = new Date()
      session.wasCompleted = true

      const totalDuration = (session.endTime.getTime() - session.startTime.getTime()) / 1000

      // Send to analytics service
      this.sendAnalyticsEvent('transcript_edit_completed', {
        story_id: storyId,
        user_id: userId,
        total_duration: totalDuration,
        edit_count: session.editCount,
        final_length: session.finalLength,
        timestamp: new Date().toISOString(),
      })

      this.sessions.delete(sessionKey)
    }
  }

  /**
   * Track when a user cancels editing without saving
   */
  trackEditCancel(storyId: string, userId: string): void {
    const sessionKey = `${storyId}-${userId}`
    const session = this.sessions.get(sessionKey)
    
    if (session) {
      const duration = (new Date().getTime() - session.startTime.getTime()) / 1000

      // Send to analytics service
      this.sendAnalyticsEvent('transcript_edit_cancelled', {
        story_id: storyId,
        user_id: userId,
        duration,
        edit_count: session.editCount,
        timestamp: new Date().toISOString(),
      })

      this.sessions.delete(sessionKey)
    }
  }

  /**
   * Track transcript editing errors
   */
  trackEditError(storyId: string, userId: string, error: string): void {
    this.sendAnalyticsEvent('transcript_edit_error', {
      story_id: storyId,
      user_id: userId,
      error_message: error,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Get transcript editing statistics
   */
  getEditingStats(): {
    totalEdits: number
    averageEditDuration: number
    averageLengthChange: number
    autoSaveRate: number
    completionRate: number
  } {
    const totalEdits = this.events.length
    const averageEditDuration = totalEdits > 0 
      ? this.events.reduce((sum, event) => sum + event.editDuration, 0) / totalEdits
      : 0
    
    const averageLengthChange = totalEdits > 0
      ? this.events.reduce((sum, event) => sum + (event.editedLength - event.originalLength), 0) / totalEdits
      : 0

    const autoSaveCount = this.events.filter(event => event.editType === 'auto_save').length
    const autoSaveRate = totalEdits > 0 ? (autoSaveCount / totalEdits) * 100 : 0

    const completedSessions = Array.from(this.sessions.values()).filter(session => session.wasCompleted).length
    const totalSessions = this.sessions.size
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0

    return {
      totalEdits,
      averageEditDuration,
      averageLengthChange,
      autoSaveRate,
      completionRate,
    }
  }

  /**
   * Get editing patterns for a specific story
   */
  getStoryEditingPattern(storyId: string): {
    editCount: number
    uniqueEditors: number
    totalLengthChange: number
    lastEditedAt: Date | null
  } {
    const storyEvents = this.events.filter(event => event.storyId === storyId)
    const uniqueEditors = new Set(storyEvents.map(event => event.userId)).size
    const totalLengthChange = storyEvents.reduce(
      (sum, event) => sum + (event.editedLength - event.originalLength), 
      0
    )
    const lastEditedAt = storyEvents.length > 0 
      ? storyEvents[storyEvents.length - 1].timestamp
      : null

    return {
      editCount: storyEvents.length,
      uniqueEditors,
      totalLengthChange,
      lastEditedAt,
    }
  }

  /**
   * Export events for analysis
   */
  exportEvents(): TranscriptEditEvent[] {
    return [...this.events]
  }

  /**
   * Clear all stored events and sessions
   */
  clearEvents(): void {
    this.events = []
    this.sessions.clear()
  }

  /**
   * Send analytics event to backend or analytics service
   */
  private sendAnalyticsEvent(eventName: string, properties: Record<string, any>): void {
    // In a real implementation, this would send to your analytics service
    // For now, we'll just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TranscriptAnalytics] ${eventName}:`, properties)
    }

    // Send to backend analytics endpoint
    try {
      fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          event: eventName,
          properties,
        }),
      }).catch(error => {
        console.error('Failed to send analytics event:', error)
      })
    } catch (error) {
      console.error('Failed to send analytics event:', error)
    }
  }
}

// Export singleton instance
export const transcriptAnalytics = new TranscriptAnalyticsService()

// Export types for use in other files
export type { TranscriptEditEvent, TranscriptEditSession }