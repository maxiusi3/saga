import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// PATCH /api/stories/:storyId/transcripts/:transcriptId - Update a transcript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { storyId: string; transcriptId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { storyId, transcriptId } = params

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if transcript exists and user has permission
    const { data: transcript, error: transcriptError } = await supabase
      .from('story_transcripts')
      .select('*, stories!inner(storyteller_id)')
      .eq('id', transcriptId)
      .eq('story_id', storyId)
      .single()

    if (transcriptError || !transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      )
    }

    // Check if user is the storyteller
    if (transcript.stories.storyteller_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the storyteller can update transcripts' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { transcript: newTranscript } = body

    if (!newTranscript) {
      return NextResponse.json(
        { error: 'Transcript text is required' },
        { status: 400 }
      )
    }

    // Update transcript
    const { data: updatedTranscript, error: updateError } = await supabase
      .from('story_transcripts')
      .update({
        transcript: newTranscript,
        updated_at: new Date().toISOString()
      })
      .eq('id', transcriptId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating transcript:', updateError)
      return NextResponse.json(
        { error: 'Failed to update transcript' },
        { status: 500 }
      )
    }

    return NextResponse.json({ transcript: updatedTranscript })
  } catch (error) {
    console.error('Update transcript error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/stories/:storyId/transcripts/:transcriptId - Delete a transcript
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { storyId: string; transcriptId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { storyId, transcriptId } = params

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if transcript exists and user has permission
    const { data: transcript, error: transcriptError } = await supabase
      .from('story_transcripts')
      .select('*, stories!inner(storyteller_id)')
      .eq('id', transcriptId)
      .eq('story_id', storyId)
      .single()

    if (transcriptError || !transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      )
    }

    // Check if user is the storyteller
    if (transcript.stories.storyteller_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the storyteller can delete transcripts' },
        { status: 403 }
      )
    }

    // Delete audio file if exists
    if (transcript.audio_url) {
      const fileName = transcript.audio_url.split('/').pop()
      if (fileName) {
        await supabase.storage
          .from('story-audio')
          .remove([`${storyId}/transcript-${transcript.sequence_number}-${fileName}`])
      }
    }

    // Delete transcript
    const { error: deleteError } = await supabase
      .from('story_transcripts')
      .delete()
      .eq('id', transcriptId)

    if (deleteError) {
      console.error('Error deleting transcript:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete transcript' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete transcript error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
