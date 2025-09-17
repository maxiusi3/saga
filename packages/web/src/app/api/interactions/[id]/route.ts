import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const { id } = params

    // Cookies 优先，Bearer 回退
    let user: any = null
    let db: any = supabaseCookie

    const cookieAuth = await supabaseCookie.auth.getUser()
    if (cookieAuth.data.user && !cookieAuth.error) {
      user = cookieAuth.data.user
    } else {
      const token = request.headers.get('authorization')?.replace('Bearer ', '')
      if (token) {
        const admin = getSupabaseAdmin()
        const { data: tokenUser, error: tokenErr } = await admin.auth.getUser(token)
        if (tokenUser?.user && !tokenErr) {
          user = tokenUser.user
          db = admin
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 获取interaction信息
    const { data: interaction, error } = await db
      .from('interactions')
      .select(`
        *,
        facilitator:facilitator_id (
          id,
          email
        ),
        story:story_id (
          id,
          title,
          project_id
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching interaction:', error)
      return NextResponse.json({ error: 'Interaction not found' }, { status: 404 })
    }

    // 检查用户是否有权限访问这个interaction
    // 用户必须是项目成员或owner
    const projectId = interaction.story.project_id
    
    const { data: role } = await db
      .from('project_roles')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const { data: project } = await db
      .from('projects')
      .select('facilitator_id')
      .eq('id', projectId)
      .maybeSingle()

    if (!role && project?.facilitator_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json(interaction)
  } catch (err) {
    console.error('GET /api/interactions/[id] unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
