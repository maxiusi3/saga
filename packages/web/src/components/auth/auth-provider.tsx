'use client'

import { useEffect } from 'react'
import { initializeAuth } from '@/stores/auth-store'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  useEffect(() => {
    initializeAuth()
  }, [])

  return <>{children}</>
}