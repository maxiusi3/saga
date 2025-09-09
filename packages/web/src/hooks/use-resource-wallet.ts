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

      const { data, error: fetchError } = await supabase
        .from('user_resource_wallets')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No wallet found, create one
          const { error: createError } = await supabase
            .from('user_resource_wallets')
            .insert({
              user_id: user.id,
              project_vouchers: 0,
              facilitator_seats: 0,
              storyteller_seats: 0
            })

          if (createError) {
            throw createError
          }

          // 重新查询以获取触发器修改后的值
          const { data: newWallet, error: refetchError } = await supabase
            .from('user_resource_wallets')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (refetchError) {
            throw refetchError
          }

          setWallet(newWallet)
        } else {
          throw fetchError
        }
      } else {
        setWallet(data)
      }
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
