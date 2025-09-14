import { useState, useEffect } from 'react'
import { createClientSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'

export interface ResourceWallet {
  project_vouchers: number
  facilitator_seats: number
  storyteller_seats: number
  updated_at: string
}

export function useResourceWallet() {
  const [wallet, setWallet] = useState<ResourceWallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuthStore()
  const supabase = createClientSupabase()

  const fetchWallet = async () => {
    if (!user) {
      setWallet(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // 改为走同源 API，避免浏览器侧 CORS/SSL 问题
      // 携带 Bearer 令牌 + Cookie，避免服务端 Cookie 不可用导致 401
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      // 简单的重试（最多3次，指数回退 0/800/1600ms）
      let resp: Response | null = null
      for (let i = 0; i < 3; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 800 * i))
        resp = await fetch('/api/wallets/me', { credentials: 'include', headers })
        if (resp.status !== 401 && resp.ok) break
      }
      if (!resp || !resp.ok) {
        throw new Error('Failed to fetch wallet')
      }
      const data = await resp.json()

      // 服务器端 API 已处理“无记录插入+幂等初始化”，此处直接使用返回数据
      setWallet(data)
    } catch (err) {
      console.error('Error fetching resource wallet:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet')
    } finally {
      setLoading(false)
    }
  }

  const updateWallet = async (updates: Partial<Omit<ResourceWallet, 'updated_at'>>) => {
    if (!user || !wallet) return

    try {
      const { data, error: updateError } = await supabase
        .from('user_resource_wallets')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      setWallet(data)
      return data
    } catch (err) {
      console.error('Error updating resource wallet:', err)
      setError(err instanceof Error ? err.message : 'Failed to update wallet')
      throw err
    }
  }

  const hasResources = (type: 'project_vouchers' | 'facilitator_seats' | 'storyteller_seats', amount = 1) => {
    if (!wallet) return false
    return wallet[type] >= amount
  }

  const consumeResource = async (type: 'project_vouchers' | 'facilitator_seats' | 'storyteller_seats', amount = 1) => {
    if (!wallet || !hasResources(type, amount)) {
      throw new Error(`Insufficient ${type.replace('_', ' ')}`)
    }

    const updates = {
      [type]: wallet[type] - amount
    }

    return updateWallet(updates)
  }

  useEffect(() => {
    fetchWallet()
  }, [user])

  return {
    wallet,
    loading,
    error,
    fetchWallet,
    updateWallet,
    hasResources,
    consumeResource,
    refetch: fetchWallet
  }
}
