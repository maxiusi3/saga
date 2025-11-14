import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest, { params }: { params: { storyId: string } }) {
  try {
    const supabaseCookie = createRouteHandlerClient({ cookies })
    const { storyId } = params

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

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = getSupabaseAdmin()
    const body = await request.json()
    const { audio_url, audio_duration, transcript, images } = body

    // permission: storyteller of the parent story
    const { data: story } = await admin
      .from('stories')
      .select('id, storyteller_id, segments')
      .eq('id', storyId)
      .maybeSingle()

    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    if (story.storyteller_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const segment = {
      id: crypto.randomUUID(),
      audio_url: audio_url || null,
      audio_duration: audio_duration || null,
      transcript: transcript || '',
      images: Array.isArray(images) ? images : [],
      created_at: new Date().toISOString()
    }

    let segmentsArr: any[] = []

    try {
      segmentsArr = Array.isArray(story.segments) ? story.segments : []
    } catch {}

    const merged = [...segmentsArr, segment]

    // attempt update with segments jsonb; if column missing, return explicit error
    const { data: updated, error } = await admin
      .from('stories')
      .update({ segments: merged })
      .eq('id', storyId)
      .select('id, segments')
      .single()

    if (error) return NextResponse.json({ error: 'Failed to append segment', details: error.message }, { status: 500 })

    return NextResponse.json({ success: true, segments: updated.segments })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}

