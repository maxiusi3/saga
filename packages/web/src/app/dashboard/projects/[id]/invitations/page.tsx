'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, UserPlus, Mail, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

interface Invitation {
  id: string
  email: string
  role: 'facilitator' | 'co_facilitator' | 'storyteller'
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  invited_at: string
  expires_at: string
  invited_by_name?: string
}

export default function InvitationsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const projectId = params.id as string

  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  
  // New invitation form
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'facilitator' | 'co_facilitator' | 'storyteller'>('storyteller')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadInvitations()
  }, [projectId])

  const loadInvitations = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/invitations`)
      if (response.ok) {
        const data = await response.json()
        setInvitations(data)
      } else {
        toast.error('Failed to load invitations')
      }
    } catch (error) {
      console.error('Error loading invitations:', error)
      toast.error('Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }

  const sendInvitation = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setSending(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          role,
          message: message.trim() || undefined
        })
      })

      if (response.ok) {
        toast.success('Invitation sent successfully')
        setEmail('')
        setMessage('')
        setRole('storyteller')
        loadInvitations()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send invitation')
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      toast.error('Failed to send invitation')
    } finally {
      setSending(false)
    }
  }

  const deleteInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/invitations/${invitationId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Invitation deleted')
        loadInvitations()
      } else {
        toast.error('Failed to delete invitation')
      }
    } catch (error) {
      console.error('Error deleting invitation:', error)
      toast.error('Failed to delete invitation')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'accepted':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="h-3 w-3 mr-1" />Accepted</Badge>
      case 'declined':
        return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>
      case 'expired':
        return <Badge variant="outline" className="text-gray-600 border-gray-600"><XCircle className="h-3 w-3 mr-1" />Expired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'facilitator':
        return <Badge variant="default">Facilitator</Badge>
      case 'co_facilitator':
        return <Badge variant="secondary">Co-Facilitator</Badge>
      case 'storyteller':
        return <Badge variant="outline">Storyteller</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Project Invitations</h1>
          <p className="text-muted-foreground">Manage project member invitations</p>
        </div>
      </div>

      {/* Send New Invitation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Send New Invitation</span>
          </CardTitle>
          <CardDescription>
            Invite new members to join this project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(value: any) => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="storyteller">Storyteller</SelectItem>
                  <SelectItem value="co_facilitator">Co-Facilitator</SelectItem>
                  <SelectItem value="facilitator">Facilitator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal message to the invitation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <Button onClick={sendInvitation} disabled={sending || !email.trim()}>
            <Mail className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Invitation'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Sent Invitations</CardTitle>
          <CardDescription>
            View and manage all project invitations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading invitations...</div>
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">No invitations sent yet</div>
            </div>
          ) : (
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{invitation.email}</span>
                      {getRoleBadge(invitation.role)}
                      {getStatusBadge(invitation.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Invited {formatDate(invitation.invited_at)} • Expires {formatDate(invitation.expires_at)}
                    </div>
                  </div>
                  
                  {invitation.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteInvitation(invitation.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
