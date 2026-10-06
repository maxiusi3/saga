import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/server/auth'

export async function POST(request: NextRequest) {
  // SEC-01 FIX: Require authentication
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) {
    return auth.response
  }

  try {
    const admin = getSupabaseAdmin()
    const body = await request.json()
    const paths: string[] = Array.isArray(body?.paths) ? body.paths : []

    if (!paths || paths.length === 0) {
      return NextResponse.json({ error: 'No paths provided' }, { status: 400, headers: auth.headers })
    }

    // Validate that all paths belong to the authenticated user
    const userId = auth.user.id
    const invalidPaths = paths.filter(path => {
      // Paths must start with user's ID: {userId}/...
      return !path.startsWith(`${userId}/`)
    })

    if (invalidPaths.length > 0) {
      return NextResponse.json(
        { error: 'Unauthorized: Cannot delete files that do not belong to you', invalidPaths },
        { status: 403, headers: auth.headers }
      )
    }

    const { data, error } = await admin.storage.from('saga').remove(paths)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: auth.headers })
    }

    return NextResponse.json({ success: true, removed: data }, { headers: auth.headers })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to delete images' },
      { status: 500 }
    )
  }
}