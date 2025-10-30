'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  Mic,
  Sparkles,
  Lock,
  Users,
  Archive,
  Star,
  ArrowRight,
  Mail,
  Twitter,
  Facebook,
  Linkedin,
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import LocaleSwitcher from '@/components/i18n/LocaleSwitcher'

export default function HomePage() {
  const t = useTranslations('pages.home')
  const router = useRouter()
  const [email, setEmail] = useState('')
  const locale = useLocale()

  const withLocale = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`
    const seg = normalized.split('/')[1]
    if (seg === 'en' || seg === 'zh-CN' || seg === 'zh-TW') return normalized
    return `/${locale}${normalized}`
  }

  // i18n helpers
  const renderWithBreaks = (text: string) => {
    const parts = text.split('\n')
    return parts.map((line, idx) => (
      <span key={idx}>
        {line}
        {idx < parts.length - 1 && <br />}
      </span>
    ))
  }

  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/)
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const finalCtaTitleParts = t('finalCta.title').split('\n')

  useEffect(() => {
    // Check if URL contains auth tokens from Supabase
    const urlParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = urlParams.get('access_token') || hashParams.get('access_token')
    const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token')
    const tokenType = urlParams.get('token_type') || hashParams.get('token_type')
    const type = urlParams.get('type') || hashParams.get('type')

    if (accessToken && refreshToken && type === 'magiclink') {
      router.push(
        `/${locale}/dashboard?access_token=${accessToken}&refresh_token=${refreshToken}&token_type=${tokenType}&type=${type}`
      )
    } else if (type === 'invite') {
      checkPendingInvitations()
    }

    async function checkPendingInvitations() {
      try {
        let retryCount = 0
        const maxRetries = 3

        const checkWithRetry = async () => {
          try {
            const { createClientSupabase } = await import('@/lib/supabase')
            const supabase = createClientSupabase()
            const {
              data: { session },
            } = await supabase.auth.getSession()

            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            }

            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const response = await fetch('/api/invitations/check-pending', {
              credentials: 'include',
              headers,
            })

            if (response.ok) {
              const data = await response.json()
              if (data.hasPendingInvitations) {
                router.push(`/${locale}/accept-invitation`)
                return true
              }
              return false
            } else if (response.status === 401 && retryCount < maxRetries - 1) {
              retryCount++
              setTimeout(checkWithRetry, 2000)
              return
            }
            return false
          } catch (error) {
            if (retryCount < maxRetries - 1) {
              retryCount++
              setTimeout(checkWithRetry, 2000)
              return
            }
            return false
          }
        }

        setTimeout(checkWithRetry, 2000)
      } catch (error) {
        console.error('Error checking pending invitations:', error)
      }
    }
  }, [router])

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#2D5A3D]" />
            <span className="text-xl font-bold text-[#2D5A3D]">{t('navigation.brandName')}</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-gray-700">
            <a href="#features" className="hover:text-[#2D5A3D] transition-colors">
              {t('navigation.features')}
            </a>
            <a href="#how-it-works" className="hover:text-[#2D5A3D] transition-colors">
              {t('navigation.howItWorks')}
            </a>
            <a href="#testimonials" className="hover:text-[#2D5A3D] transition-colors">
              {t('navigation.testimonials')}
            </a>
            <a href="#pricing" className="hover:text-[#2D5A3D] transition-colors">
              {t('navigation.pricing')}
            </a>
          </div>
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <Link href={`/${locale}/auth/signin`}>
              <Button className="bg-[#F59E0B] text-white hover:bg-[#D97706]">
                {t('navigation.startFree')}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=2070')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#2D5A3D]/95 via-[#3D6B4D]/90 to-[#2D5A3D]/95"></div>
        </div>

        <div className="relative z-10 text-center px-6 max-w-5xl animate-fade-in-up">
          <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-[#F59E0B]/90 font-semibold mb-8">
            {t('hero.tagline')}
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-8 leading-[1.1] tracking-tight">
            {renderWithBreaks(t('hero.title'))}
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
            <Link href={`/${locale}/auth/signin`}>
              <Button
                size="lg"
                className="bg-[#F59E0B] text-white hover:bg-[#D97706] text-lg px-10 py-6 rounded-xl shadow-2xl hover:shadow-[0_25px_70px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1 font-semibold group"
              >
                {t('hero.ctaPrimary')}
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button
                variant="outline"
                size="lg"
                className="bg-white/10 text-white border-2 border-white/40 hover:bg-white/20 hover:border-white text-lg px-10 py-6 rounded-xl backdrop-blur-md transition-all duration-300"
              >
                {t('hero.ctaSecondary')}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* The Fragile Truth Section */}
      <section className="py-32 px-6 bg-gradient-to-b from-white to-[#F5F1E8]/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-[#2D5A3D]/70 font-semibold mb-6">
              {t('fragiletruth.tagline')}
            </p>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight text-[#2D5A3D]">
              {renderWithBreaks(t('fragiletruth.title'))}
            </h2>
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              {t('fragiletruth.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm hover:shadow-md transition-all duration-300">
              <div className="text-5xl md:text-6xl font-bold text-[#2D5A3D] mb-4">
                {t('fragiletruth.stat1Value')}
              </div>
              <p className="text-base text-gray-600 leading-relaxed">
                {t('fragiletruth.stat1Label')}
              </p>
            </div>
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm hover:shadow-md transition-all duration-300">
              <div className="text-5xl md:text-6xl font-bold text-[#2D5A3D] mb-4">
                {t('fragiletruth.stat2Value')}
              </div>
              <p className="text-base text-gray-600 leading-relaxed">
                {t('fragiletruth.stat2Label')}
              </p>
            </div>
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm hover:shadow-md transition-all duration-300">
              <div className="text-5xl md:text-6xl font-bold text-[#2D5A3D] mb-4">
                {t('fragiletruth.stat3Value')}
              </div>
              <p className="text-base text-gray-600 leading-relaxed">
                {t('fragiletruth.stat3Label')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 px-6 bg-gradient-to-b from-[#F5F1E8]/30 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight text-[#2D5A3D]">
              {t('features.title')}
            </h2>
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
              {t('features.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-8 border-t-4 border-t-[#2D5A3D] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:col-span-2">
              <div className="w-14 h-14 bg-[#F5F1E8] rounded-xl flex items-center justify-center mb-6">
                <Mic className="w-7 h-7 text-[#2D5A3D]" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 tracking-tight text-[#2D5A3D]">
                {t('features.feature1.title')}
              </h3>
              <p className="text-base text-gray-600 leading-relaxed">
                {t('features.feature1.description')}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 border-t-4 border-t-[#F59E0B] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-14 h-14 bg-[#F5F1E8] rounded-xl flex items-center justify-center mb-6">
                <Sparkles className="w-7 h-7 text-[#2D5A3D]" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 tracking-tight text-[#2D5A3D]">
                {t('features.feature2.title')}
              </h3>
              <p className="text-base text-gray-600 leading-relaxed">
                {t('features.feature2.description')}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 border-t-4 border-t-[#2D5A3D] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-14 h-14 bg-[#F5F1E8] rounded-xl flex items-center justify-center mb-6">
                <Lock className="w-7 h-7 text-[#2D5A3D]" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 tracking-tight text-[#2D5A3D]">
                {t('features.feature3.title')}
              </h3>
              <p className="text-base text-gray-600 leading-relaxed">
                {t('features.feature3.description')}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 border-t-4 border-t-[#F59E0B] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-14 h-14 bg-[#F5F1E8] rounded-xl flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-[#2D5A3D]" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 tracking-tight text-[#2D5A3D]">
                {t('features.feature4.title')}
              </h3>
              <p className="text-base text-gray-600 leading-relaxed">
                {t('features.feature4.description')}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 border-t-4 border-t-[#2D5A3D] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-14 h-14 bg-[#F5F1E8] rounded-xl flex items-center justify-center mb-6">
                <Archive className="w-7 h-7 text-[#2D5A3D]" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 tracking-tight text-[#2D5A3D]">
                {t('features.feature5.title')}
              </h3>
              <p className="text-base text-gray-600 leading-relaxed">
                {t('features.feature5.description')}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 border-t-4 border-t-[#F59E0B] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-14 h-14 bg-[#F5F1E8] rounded-xl flex items-center justify-center mb-6">
                <BookOpen className="w-7 h-7 text-[#2D5A3D]" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 tracking-tight text-[#2D5A3D]">
                {t('features.feature6.title')}
              </h3>
              <p className="text-base text-gray-600 leading-relaxed">
                {t('features.feature6.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 px-6 bg-gradient-to-br from-[#2D5A3D] to-[#3D6B4D] text-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-white/70 font-semibold mb-6">
              {t('howItWorks.tagline')}
            </p>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight">
              {renderWithBreaks(t('howItWorks.title'))}
            </h2>
          </div>
          <div className="space-y-12">
            <div className="grid md:grid-cols-[100px_1fr] gap-6 items-start">
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-2xl font-bold">
                1
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3">
                  {t('howItWorks.step1.title')}
                </h3>
                <p className="text-lg text-white/85 leading-relaxed">
                  {t('howItWorks.step1.description')}
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-[100px_1fr] gap-6 items-start">
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-2xl font-bold">
                2
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3">
                  {t('howItWorks.step2.title')}
                </h3>
                <p className="text-lg text-white/85 leading-relaxed">
                  {t('howItWorks.step2.description')}
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-[100px_1fr] gap-6 items-start">
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-2xl font-bold">
                3
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3">
                  {t('howItWorks.step3.title')}
                </h3>
                <p className="text-lg text-white/85 leading-relaxed">
                  {t('howItWorks.step3.description')}
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-[100px_1fr] gap-6 items-start">
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-2xl font-bold">
                4
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3">
                  {t('howItWorks.step4.title')}
                </h3>
                <p className="text-lg text-white/85 leading-relaxed">
                  {t('howItWorks.step4.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-32 px-6 bg-gradient-to-b from-white to-[#F5F1E8]/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight text-[#2D5A3D]">
              {t('testimonials.title')}
            </h2>
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
              {t('testimonials.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: t('testimonials.testimonial1.name'),
                role: t('testimonials.testimonial1.role'),
                quote: t('testimonials.testimonial1.quote'),
              },
              {
                name: t('testimonials.testimonial2.name'),
                role: t('testimonials.testimonial2.role'),
                quote: t('testimonials.testimonial2.quote'),
              },
              {
                name: t('testimonials.testimonial3.name'),
                role: t('testimonials.testimonial3.role'),
                quote: t('testimonials.testimonial3.quote'),
              },
            ].map((testimonial, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-8 border-l-4 border-[#F59E0B] shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-[#F59E0B] text-[#F59E0B]" />
                  ))}
                </div>
                <p className="text-base leading-relaxed mb-6 text-gray-900">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3D6B4D] to-[#2D5A3D] flex items-center justify-center text-white font-semibold text-sm">
                    {getInitials(testimonial.name)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-32 px-6 text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/cta-background.jpg')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#2D5A3D]/95 via-[#3D6B4D]/90 to-[#2D5A3D]/95"></div>
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-white/70 font-semibold mb-8">
            {t('finalCta.tagline')}
          </p>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight tracking-tight">
            {finalCtaTitleParts[0]}
            <br />
            <span className="border-b-4 border-white/40 pb-2">
              {finalCtaTitleParts[1] ?? ''}
            </span>
          </h2>
          <p className="text-lg md:text-xl mb-12 leading-relaxed text-white/90 max-w-2xl mx-auto">
            {t('finalCta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-xl mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 border-2 border-white/30 text-white placeholder:text-white/60 h-14 px-6 rounded-xl backdrop-blur-md focus:bg-white/20 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/50"
              placeholder={t('finalCta.emailPlaceholder')}
            />
            <Link href={`/${locale}/auth/signin`}>
              <Button className="w-full sm:w-auto bg-[#F59E0B] text-white hover:bg-[#D97706] text-base px-10 py-6 rounded-xl shadow-2xl hover:shadow-[0_25px_70px_rgba(0,0,0,0.4)] transition-all duration-300 font-semibold whitespace-nowrap">
                {t('finalCta.ctaButton')}
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/70">{t('finalCta.trial')}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#2D5A3D] text-white py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-[2fr_1fr_1fr] gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div className="text-2xl font-bold">{t('footer.brandName')}</div>
              </div>
              <p className="text-white/70 leading-relaxed max-w-md mb-6">
                {t('footer.tagline')}
              </p>
              <div className="flex gap-3">
                <a
                  href="#"
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  <Twitter className="w-4 h-4" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  <Facebook className="w-4 h-4" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 uppercase tracking-wider text-white/60 text-sm">
                {t('footer.product.title')}
              </h4>
              <ul className="space-y-3 text-white/80">
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    {t('footer.product.features')}
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition-colors">
                    {t('footer.product.pricing')}
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-white transition-colors">
                    {t('footer.product.howItWorks')}
                  </a>
                </li>
                <li>
                  <a href="#security" className="hover:text-white transition-colors">
                    {t('footer.product.security')}
                  </a>
                </li>
                <li>
                  <a href="#api" className="hover:text-white transition-colors">
                    {t('footer.product.api')}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 uppercase tracking-wider text-white/60 text-sm">
                {t('footer.company.title')}
              </h4>
              <ul className="space-y-3 text-white/80">
                <li>
                  <a href="#about" className="hover:text-white transition-colors">
                    {t('footer.company.aboutUs')}
                  </a>
                </li>
                <li>
                  <a href="#blog" className="hover:text-white transition-colors">
                    {t('footer.company.blog')}
                  </a>
                </li>
                <li>
                  <a href="#careers" className="hover:text-white transition-colors">
                    {t('footer.company.careers')}
                  </a>
                </li>
                <li>
                  <a href="#press" className="hover:text-white transition-colors">
                    {t('footer.company.pressKit')}
                  </a>
                </li>
                <li>
                  <a href="#contact" className="hover:text-white transition-colors">
                    {t('footer.company.contact')}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 pt-8 text-center text-white/60 text-sm">
            {t('footer.copyright')}
          </div>
        </div>
      </footer>
    </>
  )
}
