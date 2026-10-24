export async function GET() {
  // There is no trusted list contract yet. Do not infer that the list is empty.
  return Response.json({
    success: false,
    outcome: 'not_attempted',
    error: 'Invitation discovery is unavailable. Reopen the original invitation link.',
    can_query_status: false,
  }, { status: 503, headers: { 'Cache-Control': 'no-store', Vary: 'Authorization' } })
}
