import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Manual cleanup endpoint for expired invitations
 * This can be called by cron jobs or administrators
 */
export async function POST(request: NextRequest) {
  try {
    const adminSupabase = getSupabaseAdmin()
    
    // Call the cleanup function
    const { data, error } = await adminSupabase
      .rpc('cleanup_expired_invitations')
    
    if (error) {
      console.error('Error running invitation cleanup:', error)
      return NextResponse.json(
        { error: 'Failed to cleanup expired invitations' },
        { status: 500 }
      )
    }
    
    console.log('Invitation cleanup completed:', data)
    
    return NextResponse.json({
      success: true,
      result: data,
      message: 'Expired invitations cleaned up successfully'
    })
    
  } catch (error) {
    console.error('Error in invitation cleanup endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check for expired invitations and trigger cleanup
 * This can be used for health checks or monitoring
 */
export async function GET(request: NextRequest) {
  try {
    const adminSupabase = getSupabaseAdmin()
    
    // Check for expired invitations
    const { data: expiredInvitations, error: checkError } = await adminSupabase
      .from('invitations')
      .select('id, expires_at, role, inviter_id')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
    
    if (checkError) {
      return NextResponse.json(
        { error: 'Failed to check expired invitations' },
        { status: 500 }
      )
    }
    
    const expiredCount = expiredInvitations?.length || 0
    
    // If there are expired invitations, trigger cleanup
    let cleanupResult = null
    if (expiredCount > 0) {
      const { data: cleanupData } = await adminSupabase
        .rpc('cleanup_expired_invitations')
      cleanupResult = cleanupData
    }
    
    return NextResponse.json({
      expired_invitations_found: expiredCount,
      cleanup_triggered: expiredCount > 0,
      cleanup_result: cleanupResult,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error checking expired invitations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}