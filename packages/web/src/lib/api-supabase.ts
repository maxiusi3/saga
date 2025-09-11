import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

// 统一的Supabase API客户端，替换混合的API调用
class SupabaseApiClient {
  private supabase = createClientSupabase()

  // 认证相关 - 完全使用Supabase Auth
  auth = {
    signIn: async (email: string, password: string) => {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return data
    },

    signUp: async (userData: { name: string; email: string; password: string }) => {
      const { data, error } = await this.supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
          }
        }
      })
      if (error) throw error
      return data
    },

    signOut: async () => {
      const { error } = await this.supabase.auth.signOut()
      if (error) throw error
    },

    getCurrentUser: async () => {
      const { data: { user }, error } = await this.supabase.auth.getUser()
      if (error) throw error
      return user
    },

    getSession: async () => {
      const { data: { session }, error } = await this.supabase.auth.getSession()
      if (error) throw error
      return session
    }
  }

  // 用户资料管理
  profile = {
    get: async () => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      return data
    },

    update: async (updates: { name?: string; phone?: string }) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },

    create: async (profileData: { name: string; email: string; phone?: string }) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase
        .from('profiles')
        .insert({
          id: user.id,
          ...profileData
        })
        .select()
        .single()

      if (error) throw error
      return data
    }
  }

  // 资源钱包管理
  wallet = {
    get: async () => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase
        .from('user_resource_wallets')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
      
      // 如果没有钱包记录，创建一个
      if (!data) {
        const { error: createError } = await this.supabase
          .from('user_resource_wallets')
          .insert({
            user_id: user.id,
            project_vouchers: 0,
            facilitator_seats: 0,
            storyteller_seats: 0
          })

        if (createError) throw createError

        // 重新查询以获取触发器修改后的值
        const { data: newWallet, error: refetchError } = await this.supabase
          .from('user_resource_wallets')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (refetchError) throw refetchError

        // 兜底：如果触发器未生效且仍为0，进行一次性初始化（幂等）
        if (
          newWallet &&
          newWallet.project_vouchers === 0 &&
          newWallet.facilitator_seats === 0 &&
          newWallet.storyteller_seats === 0
        ) {
          // 仅当仍为0时才更新，避免重复发放
          const { error: fallbackError } = await this.supabase
            .from('user_resource_wallets')
            .update({
              project_vouchers: 1,
              facilitator_seats: 2,
              storyteller_seats: 2,
              updated_at: new Date().toISOString(),
            })
            .match({ user_id: user.id, project_vouchers: 0, facilitator_seats: 0, storyteller_seats: 0 })

          if (fallbackError) throw fallbackError

          // 写入一条交易记录（用户自身可写，符合RLS）
          await this.supabase.from('seat_transactions').insert({
            user_id: user.id,
            transaction_type: 'grant',
            resource_type: 'initial_package',
            amount: 1,
            metadata: {
              action: 'initial_resource_grant_fallback',
              project_vouchers: 1,
              facilitator_seats: 2,
              storyteller_seats: 2,
              note: 'Fallback initialization due to missing trigger',
            },
          })

          // 再次查询返回
          const { data: afterFallback } = await this.supabase
            .from('user_resource_wallets')
            .select('*')
            .eq('user_id', user.id)
            .single()

          return afterFallback as typeof newWallet
        }

        return newWallet
      }

      // 兜底：已有钱包但为0时也进行幂等初始化（极少数情况下触发）
      if (
        data.project_vouchers === 0 &&
        data.facilitator_seats === 0 &&
        data.storyteller_seats === 0
      ) {
        const { error: fallbackError } = await this.supabase
          .from('user_resource_wallets')
          .update({
            project_vouchers: 1,
            facilitator_seats: 2,
            storyteller_seats: 2,
            updated_at: new Date().toISOString(),
          })
          .match({ user_id: user.id, project_vouchers: 0, facilitator_seats: 0, storyteller_seats: 0 })

        if (!fallbackError) {
          await this.supabase.from('seat_transactions').insert({
            user_id: user.id,
            transaction_type: 'grant',
            resource_type: 'initial_package',
            amount: 1,
            metadata: {
              action: 'initial_resource_grant_fallback_existing_row',
              project_vouchers: 1,
              facilitator_seats: 2,
              storyteller_seats: 2,
              note: 'Fallback initialization on existing row',
            },
          })

          const { data: refreshed } = await this.supabase
            .from('user_resource_wallets')
            .select('*')
            .eq('user_id', user.id)
            .single()

          return refreshed as typeof data
        }
      }

      return data
    },

    getTransactions: async (limit = 20, offset = 0) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase
        .from('seat_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      return data
    }
  }

  // 项目管理
  projects = {
    list: async () => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase
        .from('projects')
        .select(`
          *,
          project_roles!inner(role),
          stories(count)
        `)
        .eq('project_roles.user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },

    get: async (projectId: string) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      // 检查用户是否有访问权限
      const { data: roleCheck } = await this.supabase
        .from('project_roles')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single()

      if (!roleCheck) throw new Error('Access denied to project')

      const { data, error } = await this.supabase
        .from('projects')
        .select(`
          *,
          project_roles(
            id,
            role,
            status,
            profiles(name, email)
          ),
          stories(
            id,
            title,
            status,
            created_at,
            profiles(name)
          )
        `)
        .eq('id', projectId)
        .single()

      if (error) throw error
      return data
    },

    create: async (projectData: { name: string; description: string }) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      // 使用Supabase RPC函数处理项目创建和资源消费
      const { data, error } = await this.supabase.rpc('create_project_with_role', {
        project_name: projectData.name,
        project_description: projectData.description,
        facilitator_id: user.id,
        creator_role: 'facilitator' // API 默认创建者为 facilitator
      })

      if (error) throw error
      return data
    },

    update: async (projectId: string, updates: { name?: string; description?: string }) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      // 检查用户是否是facilitator
      const { data: roleCheck } = await this.supabase
        .from('project_roles')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('role', 'facilitator')
        .single()

      if (!roleCheck) throw new Error('Only facilitators can update projects')

      const { data, error } = await this.supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single()

      if (error) throw error
      return data
    }
  }

  // 邀请管理
  invitations = {
    send: async (projectId: string, email: string, role: 'facilitator' | 'storyteller') => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase.rpc('send_project_invitation', {
        project_id: projectId,
        inviter_id: user.id,
        invitee_email: email,
        invitation_role: role
      })

      if (error) throw error
      return data
    },

    accept: async (token: string) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase.rpc('accept_project_invitation', {
        invitation_token: token,
        user_id: user.id
      })

      if (error) throw error
      return data
    },

    list: async (projectId?: string) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      let query = this.supabase
        .from('invitations')
        .select('*')
        .eq('inviter_id', user.id)

      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      return data
    }
  }

  // 故事管理
  stories = {
    list: async (projectId: string) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase
        .from('stories')
        .select(`
          *,
          profiles(name, email)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },

    create: async (storyData: {
      project_id: string
      title: string
      content?: string
      audio_url?: string
      audio_duration?: number
    }) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase
        .from('stories')
        .insert({
          ...storyData,
          storyteller_id: user.id
        })
        .select()
        .single()

      if (error) throw error
      return data
    },

    update: async (storyId: string, updates: {
      title?: string
      content?: string
      transcript?: string
      status?: string
    }) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase
        .from('stories')
        .update(updates)
        .eq('id', storyId)
        .eq('storyteller_id', user.id) // 只能更新自己的故事
        .select()
        .single()

      if (error) throw error
      return data
    }
  }

  // 支付处理
  payments = {
    purchasePackage: async (packageId: string, paymentIntentId: string) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase.rpc('process_package_purchase', {
        package_id: packageId,
        payment_intent_id: paymentIntentId,
        user_id: user.id
      })

      if (error) throw error
      return data
    }
  }

  // 数据导出
  exports = {
    request: async (projectId: string, options: {
      includeAudio: boolean
      includePhotos: boolean
      includeTranscripts: boolean
      includeInteractions: boolean
    }) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase.rpc('request_data_export', {
        project_id: projectId,
        user_id: user.id,
        export_options: options
      })

      if (error) throw error
      return data
    },

    getStatus: async (exportId: string) => {
      const user = await this.auth.getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await this.supabase
        .from('export_requests')
        .select('*')
        .eq('id', exportId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      return data
    }
  }
}

// 导出单例实例
export const supabaseApi = new SupabaseApiClient()

// 导出类型
export type { Database }
