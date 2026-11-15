'use client'

import { useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader } from '@/components/ui/enhanced-card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, BookOpen, Users, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { projectService } from '@/lib/projects'
import { toast } from 'react-hot-toast'

export default function CreateProjectPage() {
  const t = useTranslations('create-project')
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'en'
  const withLocale = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`
    return `/${locale}${normalized}`
  }
  const { user } = useAuthStore()
  const submitting = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  const submitDisabled = loading || !user?.id || !formData.name.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || submitting.current || !formData.name.trim()) return
    submitting.current = true
    setLoading(true)
    setError(null)
    try {
      const project = await projectService.createProjectWithRole({
        name: formData.name.trim(),
        description: formData.description,
        facilitator_id: user.id,
        role: 'facilitator'
      })
      if (!project) throw new Error('Failed to create project')
      toast.success(t('success.created'))
      router.push(withLocale(`/dashboard/projects/${project.id}`))
    } catch (failure) {
      const missingRight = failure instanceof Error && /Purchase a project first|purchased project allocation/i.test(failure.message)
      setError(missingRight
        ? 'A verified, unused project purchase is required. Check your purchases below, then try again.'
        : 'Project creation could not be confirmed. Your details are kept; check your purchases before retrying.')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="container-narrow responsive-padding container max-w-2xl py-8">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-8">
        <Link href={withLocale('/dashboard/projects')}>
          <EnhancedButton variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('header.backToProjects')}
          </EnhancedButton>
        </Link>
      </div>

      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="text-6xl mb-4">🎭</div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">
              {t('header.title')}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t('header.subtitle')}
            </p>
          </div>
        </div>

        <EnhancedCard className="border-border/50 shadow-sm">
          <EnhancedCardHeader className="pb-4">
            <h2 className="flex items-center text-2xl font-semibold leading-none tracking-tight">
              <BookOpen className="w-6 h-6 mr-2 text-primary" />
              {t('form.projectDetails')}
            </h2>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <form onSubmit={handleSubmit} className="space-y-6" aria-busy={loading} aria-label={t('form.projectDetails')}>
              {/* Project Name */}
              <div className="space-y-3">
                <Label htmlFor="name" className="text-base font-medium">{t('form.projectName')} *</Label>
                <Input
                  id="name"
                  placeholder={t('form.projectNamePlaceholder')}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  className="h-12 text-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Project Description */}
              <div className="space-y-3">
                <Label htmlFor="description" className="text-base font-medium">{t('form.projectDescription')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('form.projectDescriptionPlaceholder')}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="text-lg focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              <div className="space-y-2 rounded-lg bg-muted/30 p-5">
                <p className="text-sm text-muted-foreground">Creating a project uses one verified project purchase. You will manage the project and can invite its storyteller after creation.</p>
                <Link className="inline-flex min-h-[44px] items-center font-medium underline" href={withLocale('/dashboard/purchase')}>View purchases and project rights</Link>
              </div>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

              {/* Submit Button */}
              <div className="flex justify-end space-x-4 pt-8">
                <Link href={withLocale('/dashboard/projects')}>
                  <EnhancedButton variant="outline" type="button" size="lg">
                    {t('form.cancel')}
                  </EnhancedButton>
                </Link>
                <EnhancedButton
                  type="submit"
                  disabled={submitDisabled}
                  className="min-w-[140px]"
                  size="lg"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t('form.creating')}
                    </div>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {t('form.createProject')}
                    </>
                  )}
                </EnhancedButton>
              </div>
            </form>
          </EnhancedCardContent>
        </EnhancedCard>

        {/* Info Card */}
        <EnhancedCard className="bg-muted/50">
          <EnhancedCardContent className="p-6">
            <div className="flex items-start space-x-4">
              <Users className="w-6 h-6 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-lg text-foreground mb-2">{t('info.title')}</h3>
                <ul className="text-base text-muted-foreground space-y-2">
                  <li>• {t('info.items.0')}</li>
                  <li>• {t('info.items.1')}</li>
                  <li>• {t('info.items.2')}</li>
                  <li>• {t('info.items.3')}</li>
                </ul>
              </div>
            </div>
          </EnhancedCardContent>
        </EnhancedCard>
      </div>
    </div>
  )
}
