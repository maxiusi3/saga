import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/server/authenticated-client'

/**
 * 钱包查询（服务端）
 * - 优先使用 Cookie 会话鉴权；失败则回退 Authorization: Bearer <token>
 * - 首次访问自动插入并进行幂等初始化
 * - 增加调试日志（仅错误路径），便于定位 401/SSL 相关问题
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedClient(request)
    if (!auth.ok) {
      return auth.response
    }
    const { user } = auth
    const db: any = auth.client

    // 读取钱包（无记录时 maybeSingle 返回 null）
    const { data: wallet, error: fetchError } = await db
      .from('user_resource_wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('GET /api/wallets/me: fetch error', fetchError)
      return NextResponse.json({ error: 'Failed to fetch wallet' }, { status: 500 })
    }

    // 无记录 -> 插入一条 0 值记录
    if (!wallet) {
      const { error: insertError } = await db
        .from('user_resource_wallets')
        .insert({
          user_id: user.id,
          project_vouchers: 0,
          facilitator_seats: 0,
          storyteller_seats: 0
        })

      if (insertError) {
        console.error('GET /api/wallets/me: insert error', insertError)
        return NextResponse.json({
          user_id: user.id,
          project_vouchers: 0,
          facilitator_seats: 0,
          storyteller_seats: 0,
        })
      }

      // 再次查询，读取触发器可能发放后的数据
      const { data: newWallet, error: refetchError } = await db
        .from('user_resource_wallets')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (refetchError) {
        console.error('GET /api/wallets/me: refetch error', refetchError)
        return NextResponse.json({
          user_id: user.id,
          project_vouchers: 0,
          facilitator_seats: 0,
          storyteller_seats: 0,
        })
      }

      // 兜底：若仍为 0，则进行一次性初始化（幂等）并写交易记录
      if (
        newWallet &&
        newWallet.project_vouchers === 0 &&
        newWallet.facilitator_seats === 0 &&
        newWallet.storyteller_seats === 0
      ) {
        const { error: fallbackError } = await db
          .from('user_resource_wallets')
          .update({
            project_vouchers: 1,
            facilitator_seats: 2,
            storyteller_seats: 2,
            updated_at: new Date().toISOString(),
          })
          .match({ user_id: user.id, project_vouchers: 0, facilitator_seats: 0, storyteller_seats: 0 })

        if (!fallbackError) {
          // 交易记录（用户自身可写，符合 RLS）。注意：db 可能为 admin，但仅写入 user 自己的记录
          await db.from('seat_transactions').insert({
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

          const { data: afterFallback } = await db
            .from('user_resource_wallets')
            .select('*')
            .eq('user_id', user.id)
            .single()

          return NextResponse.json(afterFallback)
        }
      }

      return NextResponse.json(newWallet)
    }

    return NextResponse.json(wallet)
  } catch (error) {
    console.error('GET /api/wallets/me: unexpected error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
