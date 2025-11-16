import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    const body = await request.json()
    const paths: string[] = Array.isArray(body?.paths) ? body.paths : []
    if (!paths || paths.length === 0) {
      return NextResponse.json({ error: 'No paths provided' }, { status: 400 })
    }

    const { data, error } = await admin.storage.from('saga').remove(paths)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, removed: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete images' }, { status: 500 })
  }
}