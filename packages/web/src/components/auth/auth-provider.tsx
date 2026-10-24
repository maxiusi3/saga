'use client'

import { useEffect } from 'react'
import { initializeAuth } from '@/stores/auth-store'
import { removeLegacyAuthNext } from '@/lib/auth-return'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  useEffect(() => {
    removeLegacyAuthNext()
    initializeAuth()
  }, [])

  return <>{children}</>
}