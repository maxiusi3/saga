import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/stories/:storyId/transcripts - Get all transcripts for a story
export async function GET(
  _request: NextRequest,
  { params }: { params: { storyId: string } }
) {
  try {
    const { storyId } = params
    console.log('[Transcripts API] GET request for story:', storyId)

    // Use admin client to bypass RLS
    const admin = getSupabaseAdmin()
    
    // Get all transcripts for this story, ordered by sequence
    const { data: transcripts, error } = await admin
      .from('story_transcripts')
      .select('*')
      .eq('story_id', storyId)
      .order('sequence_number', { ascending: true })

    if (error) {
      console.error('[Transcripts API] Error fetching transcripts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch transcripts', details: error.message },
        { status: 500 }
      )
    }

    console.log('[Transcripts API] Found transcripts:', transcripts?.length || 0)
    return NextResponse.json({ transcripts: transcripts || [] })
  } catch (error) {
    console.error('[Transcripts API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/stories/:storyId/transcripts - Create a new transcript
export async function POST(
  request: NextRequest,
  { params }: { params: { storyId: string } }
) {
  try {
    console.log('[Transcripts API] POST request received for story:', params.storyId)
    
    const { storyId } = params
    const admin = getSupabaseAdmin()

    // Extract access token from cookies manually
    let user: any = null
    let db: any = admin

    console.log('[Transcripts API] Attempting to extract auth token from cookies...')
    const cookieStore = cookies()
    const allCookies = cookieStore.getAll()
    console.log('[Transcripts API] Available cookies:', allCookies.map(c => c.name))
    
    // Try to find Supabase auth token in cookies
    const authTokenCookie = allCookies.find(c => 
      c.name.includes('supabase') && c.name.includes('auth-token')
    )
    
    if (authTokenCookie) {
      console.log('[Transcripts API] Found auth token cookie:', authTokenCookie.name)
      try {
        // Parse the cookie value (it might be JSON)
        const tokenData = JSON.parse(authTokenCookie.value)
        const accessToken = tokenData.access_token || tokenData
        
        const { data: tokenUser, error: tokenErr } = await admin.auth.getUser(accessToken)
        if (tokenUser?.user && !tokenErr) {
          user = tokenUser.user
          console.log('[Transcripts API] Cookie token auth successful:', user.id)
        }
      } catch (e) {
        console.error('[Transcripts API] Error parsing auth token:', e)
      }
    }
    
    // Fallback: try Bearer token from Authorization header
    if (!user) {
      console.log('[Transcripts API] Cookie auth failed, trying Bearer token...')
      const token = request.headers.get('authorization')?.replace('Bearer ', '')
      if (token) {
        const { data: tokenUser, error: tokenErr } = await admin.auth.getUser(token)
        if (tokenUser?.user && !tokenErr) {
          user = tokenUser.user
          console.log('[Transcripts API] Bearer token auth successful:', user.id)
        }
      }
    }
    
    if (!user) {
      console.error('[Transcripts API] No authentication method succeeded')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.log('[Transcripts API] User authenticated:', user.id)

    // Check if story exists using admin client to bypass RLS
    console.log('[Transcripts API] Checking story:', storyId)
    const adminClient = getSupabaseAdmin()
    const { data: story, error: storyError } = await adminClient
      .from('stories')
      .select('id, storyteller_id')
      .eq('id', storyId)
      .single()

    if (storyError) {
      console.error('[Transcripts API] Story query error:', storyError)
      return NextResponse.json(
        { error: 'Story not found', details: storyError.message },
        { status: 404 }
      )
    }

    if (!story) {
      console.error('[Transcripts API] Story not found:', storyId)
      return NextResponse.json(
        { error: 'Story not found' },
        { status: 404 }
      )
    }

    console.log('[Transcripts API] Story found:', story.id, 'storyteller:', story.storyteller_id)

    // Check if user is the storyteller
    if (story.storyteller_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the storyteller can add follow-up recordings' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const transcript = formData.get('transcript') as string
    const audioDuration = formData.get('audio_duration') as string
    const audioFile = formData.get('audio_file') as File | null

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      )
    }

    // Get the next sequence number
    const { data: existingTranscripts } = await db
      .from('story_transcripts')
      .select('sequence_number')
      .eq('story_id', storyId)
      .order('sequence_number', { ascending: false })
      .limit(1)

    const nextSequence = existingTranscripts && existingTranscripts.length > 0
      ? existingTranscripts[0].sequence_number + 1
      : 1

    // Upload audio file if provided
    let audioUrl: string | null = null
    if (audioFile) {
      // Use the same bucket and folder structure as other story audio uploads
      const fileName = `stories/${storyId}/transcript-${nextSequence}-${Date.now()}.webm`
      console.log('[Transcripts API] Uploading audio file:', fileName)
      
      const { error: uploadError } = await admin.storage
        .from('saga')
        .upload(fileName, audioFile, {
          contentType: audioFile.type,
          upsert: false
        })

      if (uploadError) {
        console.error('[Transcripts API] Error uploading audio:', uploadError)
        return NextResponse.json(
          { error: 'Failed to upload audio file', details: uploadError.message },
          { status: 500 }
        )
      }

      // Get public URL
      const { data: { publicUrl } } = admin.storage
        .from('saga')
        .getPublicUrl(fileName)

      audioUrl = publicUrl
      console.log('[Transcripts API] Audio uploaded successfully:', audioUrl)
    }

    // Create transcript record using admin client to bypass RLS
    console.log('[Transcripts API] Creating transcript record...')
    const { data: newTranscript, error: insertError } = await admin
      .from('story_transcripts')
      .insert({
        story_id: storyId,
        transcript,
        audio_url: audioUrl,
        audio_duration: audioDuration ? parseInt(audioDuration) : null,
        sequence_number: nextSequence,
        recorded_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Transcripts API] Error creating transcript:', insertError)
      return NextResponse.json(
        { error: 'Failed to create transcript', details: insertError.message },
        { status: 500 }
      )
    }

    console.log('[Transcripts API] Transcript created successfully:', newTranscript.id)
    return NextResponse.json({ transcript: newTranscript }, { status: 201 })
  } catch (error) {
    console.error('Create transcript error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
