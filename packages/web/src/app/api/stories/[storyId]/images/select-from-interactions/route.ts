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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const images = Array.isArray(body?.images) ? body.images : []
    if (images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    const { data: story } = await db
      .from('stories')
      .select('id, project_id, storyteller_id, images')
      .eq('id', storyId)
      .maybeSingle()

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    if (story.storyteller_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const captionBase = `/dashboard/projects/${story.project_id}/stories/${storyId}`
    const normalized = images.map((img: any) => ({
      url: img.url,
      thumbUrl: img.thumbUrl,
      source: 'comment',
      source_id: img.source_id || null,
      caption: `${captionBase}`
    })).filter((i: any) => i.url && i.thumbUrl)

    const existing = Array.isArray(story.images) ? story.images : []
    const merged = [...existing, ...normalized]

    const { data: updated, error } = await db
      .from('stories')
      .update({ images: merged })
      .eq('id', storyId)
      .select('id, images')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update images' }, { status: 500 })
    }

    return NextResponse.json({ success: true, images: updated.images })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}

