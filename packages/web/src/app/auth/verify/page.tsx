'use client'

import { useState, useEffect } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export default function VerifyPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [canResend, setCanResend] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [countdown])

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return
    
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const otpCode = otp.join('')
    if (otpCode.length !== 6) return

    setIsLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email'
      })

      if (error) throw error
      
      router.push('/dashboard')
    } catch (error) {
      setMessage('Invalid verification code. Please try again.')
      setOtp(['', '', '', '', '', ''])
      const firstInput = document.getElementById('otp-0')
      firstInput?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (!canResend) return

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) throw error
      
      setMessage('New verification code sent!')
      setCanResend(false)
      setCountdown(60)
    } catch (error) {
      setMessage('Error sending new code')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Enter Verification Code</h1>
          <p className="mt-2 text-muted-foreground">
            We sent a code to {email}
          </p>
        </div>

        <FurbridgeCard className="p-8">
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <Label className="text-center block mb-4">Verification Code</Label>
              <div className="flex justify-center space-x-2">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-12 text-center text-lg font-semibold"
                    autoComplete="one-time-code"
                  />
                ))}
              </div>
            </div>

            <FurbridgeButton
              type="submit"
              variant="orange"
              size="lg"
              className="w-full"
              disabled={isLoading || otp.join('').length !== 6}
            >
              {isLoading ? 'Verifying...' : 'Verify & Continue'}
            </FurbridgeButton>

            {message && (
              <div className={`text-sm text-center ${
                message.includes('Error') || message.includes('Invalid') 
                  ? 'text-destructive' 
                  : 'text-furbridge-teal'
              }`}>
                {message}
              </div>
            )}

            <div className="text-center">
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-furbridge-orange hover:text-furbridge-orange-hover text-sm"
                  disabled={isLoading}
                >
                  Resend Code
                </button>
              ) : (
                <span className="text-muted-foreground text-sm">
                  Resend in {countdown}s
                </span>
              )}
            </div>
          </form>
        </FurbridgeCard>
      </div>
    </div>
  )
}
