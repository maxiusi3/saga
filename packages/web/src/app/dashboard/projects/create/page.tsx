'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, BookOpen, Users, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function CreateProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    theme: 'family-memories'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 模拟项目创建过程
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 模拟创建成功，生成项目 ID
      const projectId = 'proj_' + Math.random().toString(36).substr(2, 9)
      
      console.log('Project created successfully:', { ...formData, id: projectId })
      
      // 重定向到新创建的项目页面
      router.push(`/dashboard/projects/${projectId}`)
    } catch (error) {
      console.error('Error creating project:', error)
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const themes = [
    {
      id: 'family-memories',
      name: 'Family Memories',
      description: 'Capture stories from different generations',
      icon: '👨‍👩‍👧‍👦'
    },
    {
      id: 'life-journey',
      name: 'Life Journey',
      description: 'Document personal milestones and experiences',
      icon: '🛤️'
    },
    {
      id: 'cultural-heritage',
      name: 'Cultural Heritage',
      description: 'Preserve traditions and cultural stories',
      icon: '🏛️'
    },
    {
      id: 'professional-legacy',
      name: 'Professional Legacy',
      description: 'Share career experiences and wisdom',
      icon: '💼'
    }
  ]

  return (
    <div className="container max-w-2xl py-8">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-8">
        <Link href="/dashboard/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </Link>
      </div>

      <div className="space-y-8">
        <div className="text-center">
          <div className="text-6xl mb-4">📖</div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Create a New Saga
          </h1>
          <p className="text-muted-foreground">
            Start capturing your family's precious stories
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="w-5 h-5 mr-2" />
              Project Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Project Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Smith Family Stories"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
              </div>

              {/* Project Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What stories do you want to capture? Who will be involved?"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Theme Selection */}
              <div className="space-y-3">
                <Label>Project Theme</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {themes.map((theme) => (
                    <div
                      key={theme.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        formData.theme === theme.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleInputChange('theme', theme.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="text-2xl">{theme.icon}</div>
                        <div>
                          <h3 className="font-medium text-foreground">{theme.name}</h3>
                          <p className="text-sm text-muted-foreground">{theme.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3 pt-6">
                <Link href="/dashboard/projects">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  disabled={!formData.name || loading}
                  className="min-w-[120px]"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </div>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Create Project
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <Users className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium text-foreground mb-2">What happens next?</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• You'll be the project facilitator with full access</li>
                  <li>• Invite family members as storytellers</li>
                  <li>• Start recording and organizing stories</li>
                  <li>• Use AI to generate prompts and summaries</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
