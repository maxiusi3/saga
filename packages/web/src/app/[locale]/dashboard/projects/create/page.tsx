'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from '@/components/ui/enhanced-card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, BookOpen, Users, Sparkles, Crown, Mic } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { projectService } from '@/lib/projects'
import { useResourceWallet } from '@/hooks/use-resource-wallet'
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
  const { wallet, loading: walletLoading, hasResources } = useResourceWallet()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    theme: 'family-memories',
    role: 'storyteller' // 默认选择 storyteller
  })

  // 在钱包加载完成且有数据前，禁止提交，避免“看似失败”的体验
  const submitDisabled = loading || walletLoading || !wallet || !formData.name

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) {
      console.error('User not authenticated')
      return
    }

    // 检查资源余额
    if (!wallet) {
      toast.error(t('errors.fetchBalance'))
      return
    }

    // 检查项目券
    if (!hasResources('project_vouchers', 1)) {
      // Redirect to purchase page when resources are insufficient
      toast.error(t('errors.insufficientVouchers'))
      router.push(withLocale('/dashboard/purchase'))
      return
    }

    // 检查角色席位
    const seatType = formData.role === 'facilitator' ? 'facilitator_seats' : 'storyteller_seats'
    if (!hasResources(seatType, 1)) {
      const roleName = formData.role === 'facilitator' ? t('roles.facilitator.name') : t('roles.storyteller.name')
      toast.error(t('errors.insufficientSeats', { role: roleName }))
      router.push(withLocale('/dashboard/purchase'))
      return
    }

    setLoading(true)

    try {
      console.log('Creating project:', formData)

      // 使用数据库函数创建项目并消耗资源
      const project = await projectService.createProjectWithRole({
        name: formData.name,
        description: formData.description,
        facilitator_id: user.id,
        role: formData.role as 'facilitator' | 'storyteller'
      })

      if (project) {
        console.log('Project created successfully:', project)
        toast.success(t('success.created'))
        // 重定向到新创建的项目页面
        router.push(withLocale(`/dashboard/projects/${project.id}`))
      } else {
        throw new Error('Failed to create project')
      }
    } catch (error: any) {
      console.error('Error creating project:', error)

      // Handle specific error messages
      if (error.message?.includes('Insufficient project vouchers')) {
        toast.error(t('errors.insufficientVouchers'))
      } else if (error.message?.includes('Insufficient')) {
        toast.error(t('errors.insufficientSeats', { role: '' }))
      } else {
        toast.error(t('errors.createFailed'))
      }
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
      name: t('themes.familyMemories.name'),
      description: t('themes.familyMemories.description'),
      icon: '👨‍👩‍👧‍👦'
    },
    {
      id: 'life-journey',
      name: t('themes.lifeJourney.name'),
      description: t('themes.lifeJourney.description'),
      icon: '🛤️'
    },
    {
      id: 'cultural-heritage',
      name: t('themes.culturalHeritage.name'),
      description: t('themes.culturalHeritage.description'),
      icon: '🏛️'
    },
    {
      id: 'professional-legacy',
      name: t('themes.professionalLegacy.name'),
      description: t('themes.professionalLegacy.description'),
      icon: '💼'
    }
  ]

  return (
    <div className="container max-w-2xl py-8">
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
            <EnhancedCardTitle className="flex items-center text-2xl">
              <BookOpen className="w-6 h-6 mr-2 text-primary" />
              {t('form.projectDetails')}
            </EnhancedCardTitle>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <form onSubmit={handleSubmit} className="space-y-6" aria-busy={loading}>
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

              {/* Theme Selection */}
              <div className="space-y-4">
                <Label className="text-base font-medium">{t('form.projectTheme')}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {themes.map((theme) => (
                    <div
                      key={theme.id}
                      className={`group p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${formData.theme === theme.id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/50 hover:bg-muted/30'
                        }`}
                      onClick={() => handleInputChange('theme', theme.id)}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="text-3xl group-hover:scale-110 transition-transform">{theme.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">{theme.name}</h3>
                          <p className="text-base text-muted-foreground mt-1">{theme.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-4">
                <Label className="text-base font-medium">{t('form.yourRole')}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${formData.role === 'storyteller'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                      }`}
                    onClick={() => handleInputChange('role', 'storyteller')}
                  >
                    <div className="flex items-start space-x-4">
                      <Mic className="w-8 h-8 text-primary mt-1" />
                      <div>
                        <h3 className="font-semibold text-lg text-foreground">{t('roles.storyteller.name')}</h3>
                        <p className="text-base text-muted-foreground">{t('roles.storyteller.description')}</p>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {t('roles.storyteller.resourceCost')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${formData.role === 'facilitator'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                      }`}
                    onClick={() => handleInputChange('role', 'facilitator')}
                  >
                    <div className="flex items-start space-x-4">
                      <Crown className="w-8 h-8 text-primary mt-1" />
                      <div>
                        <h3 className="font-semibold text-lg text-foreground">{t('roles.facilitator.name')}</h3>
                        <p className="text-base text-muted-foreground">{t('roles.facilitator.description')}</p>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {t('roles.facilitator.resourceCost')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resource Status */}
              {wallet && (
                <div className="bg-muted/30 rounded-lg p-6">
                  <h4 className="text-base font-medium text-foreground mb-3">{t('form.currentBalance')}</h4>
                  <div className="grid grid-cols-3 gap-6 text-base">
                    <div className="text-center">
                      <div className="font-bold text-xl text-foreground">{wallet.project_vouchers}</div>
                      <div className="text-muted-foreground">{t('form.projectVouchers')}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-xl text-foreground">{wallet.facilitator_seats}</div>
                      <div className="text-muted-foreground">{t('form.facilitatorSeats')}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-xl text-foreground">{wallet.storyteller_seats}</div>
                      <div className="text-muted-foreground">{t('form.storytellerSeats')}</div>
                    </div>
                  </div>
                </div>
              )}

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
