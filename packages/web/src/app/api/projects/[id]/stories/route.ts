import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

// 返回某项目的 stories 列表（权限：项目成员或所有者）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const projectId = params.id

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

    // 权限：项目拥有者或 active 成员
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
      return NextResponse.json({ error: 'Access denied to project' }, { status: 403 })
    }

    const { data: stories, error } = await db
      .from('stories')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('GET /api/projects/[id]/stories error:', error)
      return NextResponse.json({ stories: [] })
    }

    return NextResponse.json({ stories: stories || [] })
  } catch (err) {
    console.error('GET /api/projects/[id]/stories unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


// 创建故事（权限：项目成员或所有者），字段与前端保持一致
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const projectId = params.id

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

    // 权限：项目拥有者或 active 成员
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
      return NextResponse.json({ error: 'Access denied to project' }, { status: 403 })
    }

    const body = await request.json()

    const { data: story, error } = await db
      .from('stories')
      .insert({
        project_id: projectId,
        storyteller_id: user.id,
        title: body.title,
        content: body.content,
        audio_url: body.audio_url || null,
        audio_duration: body.audio_duration,
        transcript: body.transcript,
        ai_generated_title: body.ai_generated_title,
        ai_summary: body.ai_summary,
        ai_follow_up_questions: body.ai_follow_up_questions,
        ai_confidence_score: body.ai_confidence_score,
        status: 'ready'
      })
      .select()
      .single()

    if (error) {
      console.error('POST /api/projects/[id]/stories error:', error)
      return NextResponse.json({ error: 'Failed to create story' }, { status: 500 })
    }

    return NextResponse.json({ story })
  } catch (err) {
    console.error('POST /api/projects/[id]/stories unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
