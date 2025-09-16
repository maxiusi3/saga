import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Mail, 
  QrCode, 
  Copy, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Send,
  Users,
  Shield
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import QRCode from 'qrcode'

interface Invitation {
  id: string
  project_id: string
  inviter_id: string
  invitee_email: string
  role: 'facilitator' | 'storyteller'
  status: 'pending' | 'accepted' | 'expired' | 'declined'
  token: string
  expires_at: string
  created_at: string
  updated_at: string
}

interface InvitationManagerProps {
  projectId: string
  className?: string
}

export function InvitationManager({ projectId, className }: InvitationManagerProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newInviteEmail, setNewInviteEmail] = useState('')
  const [newInviteRole, setNewInviteRole] = useState<'facilitator' | 'storyteller'>('storyteller')
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [showQrCode, setShowQrCode] = useState<string | null>(null)

  useEffect(() => {
    fetchInvitations()
  }, [projectId])

  const fetchInvitations = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/invitations`)
      if (!response.ok) {
        throw new Error('Failed to fetch invitations')
      }
      const data = await response.json()
      setInvitations(data)
    } catch (error) {
      console.error('Error fetching invitations:', error)
      toast.error('Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }

  const sendInvitation = async () => {
    if (!newInviteEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    try {
      setSending(true)
      const response = await fetch(`/api/projects/${projectId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newInviteEmail.trim(),
          role: newInviteRole
        })
      })

      if (!response.ok) {
        const errorData = await response.json()

        // 处理席位不足的情况
        if (response.status === 402 && errorData.errorCode === 'INSUFFICIENT_SEATS') {
          toast.error(errorData.error || 'Insufficient seats')
          // 显示购买提示
          if (confirm('You need more seats to send this invitation. Would you like to purchase more seats now?')) {
            window.location.href = errorData.purchaseUrl || '/dashboard/purchase'
          }
          return
        }

        throw new Error(errorData.error || 'Failed to send invitation')
      }

      const newInvitation = await response.json()
      setInvitations(prev => [newInvitation, ...prev])
      setNewInviteEmail('')
      toast.success('Invitation sent successfully!')
    } catch (error) {
      console.error('Error sending invitation:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation')
    } finally {
      setSending(false)
    }
  }

  const generateQrCode = async (token: string) => {
    try {
      const inviteUrl = `${window.location.origin}/invite/${token}`
      const qrCodeDataUrl = await QRCode.toDataURL(inviteUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      setQrCodeUrl(qrCodeDataUrl)
      setShowQrCode(token)
    } catch (error) {
      console.error('Error generating QR code:', error)
      toast.error('Failed to generate QR code')
    }
  }

  const copyInviteLink = async (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('Invitation link copied to clipboard!')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast.error('Failed to copy link')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-600">Pending</Badge>
      case 'accepted':
        return <Badge variant="default" className="bg-green-600">Accepted</Badge>
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getRoleIcon = (role: string) => {
    return role === 'facilitator' ? <Shield className="h-4 w-4" /> : <Users className="h-4 w-4" />
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()
    
    if (diff <= 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    } else {
      return `${minutes}m remaining`
    }
  }

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="space-y-4">
          <div className="h-6 bg-muted rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Project Invitations
          </h3>
          <FurbridgeButton onClick={fetchInvitations} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" />
          </FurbridgeButton>
        </div>

        {/* Send New Invitation */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium text-foreground">Send New Invitation</h4>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={newInviteEmail}
              onChange={(e) => setNewInviteEmail(e.target.value)}
              className="flex-1"
            />
            <select
              value={newInviteRole}
              onChange={(e) => setNewInviteRole(e.target.value as 'facilitator' | 'storyteller')}
              className="px-3 py-2 border border-border rounded-md bg-background"
            >
              <option value="storyteller">Storyteller</option>
              <option value="facilitator">Co-Facilitator</option>
            </select>
            <FurbridgeButton 
              onClick={sendInvitation}
              disabled={sending || !newInviteEmail.trim()}
            >
              {sending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </FurbridgeButton>
          </div>
          <p className="text-xs text-muted-foreground">
            Invitations expire after 72 hours for security.
          </p>
        </div>

        {/* Existing Invitations */}
        <div className="space-y-3">
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No invitations sent yet</p>
            </div>
          ) : (
            invitations.map((invitation) => (
              <div key={invitation.id} className="p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {invitation.invitee_email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {invitation.invitee_email}
                        </span>
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getRoleIcon(invitation.role)}
                          {invitation.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {invitation.status === 'pending' && !isExpired(invitation.expires_at) ? (
                          getTimeRemaining(invitation.expires_at)
                        ) : (
                          `Sent ${new Date(invitation.created_at).toLocaleDateString()}`
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getStatusBadge(invitation.status)}
                    
                    {invitation.status === 'pending' && !isExpired(invitation.expires_at) && (
                      <div className="flex gap-1">
                        <FurbridgeButton
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInviteLink(invitation.token)}
                          title="Copy invitation link"
                        >
                          <Copy className="h-4 w-4" />
                        </FurbridgeButton>
                        <FurbridgeButton
                          variant="ghost"
                          size="sm"
                          onClick={() => generateQrCode(invitation.token)}
                          title="Generate QR code"
                        >
                          <QrCode className="h-4 w-4" />
                        </FurbridgeButton>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* QR Code Modal */}
        {showQrCode && qrCodeUrl && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="p-6 max-w-sm w-full mx-4">
              <div className="text-center space-y-4">
                <h3 className="font-semibold text-foreground">Invitation QR Code</h3>
                <img src={qrCodeUrl} alt="QR Code" className="mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Scan this QR code to accept the invitation
                </p>
                <FurbridgeButton 
                  onClick={() => {
                    setShowQrCode(null)
                    setQrCodeUrl(null)
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Close
                </FurbridgeButton>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Card>
  )
}
