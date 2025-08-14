export interface Invitation {
  id: string
  projectId: string
  token: string
  role: 'facilitator' | 'storyteller'
  status: 'pending' | 'accepted' | 'expired'
  expiresAt: Date
  usedAt?: Date
  createdAt: Date
}

export interface CreateInvitationInput {
  projectId: string
  role: 'facilitator' | 'storyteller'
  expiresAt?: Date
}

export interface AcceptInvitationInput {
  token: string
  userId?: string
  name?: string
  email?: string
  phone?: string
}