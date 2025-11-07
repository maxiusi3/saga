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
    const supabase = createRouteHandlerClient({ cookies })
    const { storyId } = params

    // Get all transcripts for this story, ordered by sequence
    const { data: transcripts, error } = await supabase
      .from('story_transcripts')
      .select('*')
      .eq('story_id', storyId)
      .order('sequence_number', { ascending: true })

    if (error) {
      console.error('Error fetching transcripts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch transcripts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ transcripts: transcripts || [] })
  } catch (error) {
    console.error('Transcripts API error:', error)
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
    const supabase = createRouteHandlerClient({ cookies })
    const { storyId } = params

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[Transcripts API] Auth error:', authError)
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
    const { data: existingTranscripts } = await supabase
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
      const fileName = `${storyId}/transcript-${nextSequence}-${Date.now()}.webm`
      const { error: uploadError } = await supabase.storage
        .from('story-audio')
        .upload(fileName, audioFile, {
          contentType: audioFile.type,
          upsert: false
        })

      if (uploadError) {
        console.error('Error uploading audio:', uploadError)
        return NextResponse.json(
          { error: 'Failed to upload audio file' },
          { status: 500 }
        )
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('story-audio')
        .getPublicUrl(fileName)

      audioUrl = publicUrl
    }

    // Create transcript record
    const { data: newTranscript, error: insertError } = await supabase
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
      console.error('Error creating transcript:', insertError)
      return NextResponse.json(
        { error: 'Failed to create transcript' },
        { status: 500 }
      )
    }

    return NextResponse.json({ transcript: newTranscript }, { status: 201 })
  } catch (error) {
    console.error('Create transcript error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
