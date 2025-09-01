'use client'

import { useState, useEffect } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@supabase/supabase-js'
import { User } from '@supabase/supabase-js'
import { Camera, Save } from 'lucide-react'

interface UserProfile {
  full_name: string
  email: string
  avatar_url?: string
  phone?: string
  bio?: string
  joined_date: string
  total_projects: number
  total_stories: number
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    bio: ''
  })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
          // Mock profile data - replace with actual Supabase queries
          const mockProfile: UserProfile = {
            full_name: user.user_metadata?.full_name || user.email || '',
            email: user.email || '',
            avatar_url: user.user_metadata?.avatar_url,
            phone: '',
            bio: '',
            joined_date: '2024-01-15T10:30:00Z',
            total_projects: 2,
            total_stories: 8
          }

          setProfile(mockProfile)
          setFormData({
            full_name: mockProfile.full_name,
            phone: mockProfile.phone || '',
            bio: mockProfile.bio || ''
          })
        }
      } catch (error) {
        console.error('Error loading profile:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [supabase])

  const handleSave = async () => {
    if (!user || !profile) return

    setSaving(true)
    try {
      // TODO: Update profile in Supabase
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setProfile({
        ...profile,
        full_name: formData.full_name,
        phone: formData.phone,
        bio: formData.bio
      })
      
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setFormData({
        full_name: profile.full_name,
        phone: profile.phone || '',
        bio: profile.bio || ''
      })
    }
    setIsEditing(false)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-foreground">Profile not found</h1>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
        {!isEditing && (
          <FurbridgeButton variant="outline" onClick={() => setIsEditing(true)}>
            Edit Profile
          </FurbridgeButton>
        )}
      </div>

      {/* Profile Card */}
      <FurbridgeCard className="p-8">
        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-2xl">
                  {profile.full_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <FurbridgeButton
                  variant="outline"
                  size="icon"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
                >
                  <Camera className="h-4 w-4" />
                </FurbridgeButton>
              )}
            </div>
            
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-foreground">
                {profile.full_name}
              </h2>
              <p className="text-muted-foreground">{profile.email}</p>
              <p className="text-sm text-muted-foreground">
                Member since {new Date(profile.joined_date).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Profile Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                {isEditing ? (
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-foreground">{profile.full_name}</div>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <div className="mt-1 text-muted-foreground">{profile.email}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              {isEditing ? (
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-foreground">
                  {profile.phone || 'Not provided'}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              {isEditing ? (
                <textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell us a little about yourself..."
                  rows={3}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-furbridge-orange focus:border-furbridge-orange"
                />
              ) : (
                <div className="mt-1 text-foreground">
                  {profile.bio || 'No bio provided'}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex space-x-3 pt-4">
              <FurbridgeButton
                variant="orange"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </FurbridgeButton>
              <FurbridgeButton
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </FurbridgeButton>
            </div>
          )}
        </div>
      </FurbridgeCard>

      {/* Stats Card */}
      <FurbridgeCard className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Activity Summary</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-furbridge-orange">
                {profile.total_projects}
              </div>
              <div className="text-sm text-muted-foreground">
                Active Projects
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-furbridge-teal">
                {profile.total_stories}
              </div>
              <div className="text-sm text-muted-foreground">
                Stories Shared
              </div>
            </div>
          </div>
        </div>
      </FurbridgeCard>

      {/* Account Settings */}
      <FurbridgeCard className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Account Settings</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-foreground">Email Notifications</div>
                <div className="text-sm text-muted-foreground">
                  Receive updates about your projects
                </div>
              </div>
              <Badge variant="secondary">Enabled</Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-foreground">Privacy Settings</div>
                <div className="text-sm text-muted-foreground">
                  Control who can see your profile
                </div>
              </div>
              <FurbridgeButton variant="outline" size="sm">
                Manage
              </FurbridgeButton>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-foreground">Data Export</div>
                <div className="text-sm text-muted-foreground">
                  Download your account data
                </div>
              </div>
              <FurbridgeButton variant="outline" size="sm">
                Export
              </FurbridgeButton>
            </div>
          </div>
        </div>
      </FurbridgeCard>
    </div>
  )
}
