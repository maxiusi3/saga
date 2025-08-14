/**
 * Interaction interface for v1.5 with facilitator attribution
 * Supports multi-facilitator collaboration
 */
export interface Interaction {
  id: string
  storyId: string
  facilitatorId: string
  type: 'comment' | 'followup'
  content: string
  answeredAt?: Date
  createdAt: Date
  updatedAt: Date
  
  // Relationships
  facilitator?: any // Avoid circular import
  story?: any // Avoid circular import
}

export interface CreateInteractionInput {
  storyId: string
  facilitatorId: string
  type: 'comment' | 'followup'
  content: string
}

export interface UpdateInteractionInput {
  content?: string
  answeredAt?: Date
}