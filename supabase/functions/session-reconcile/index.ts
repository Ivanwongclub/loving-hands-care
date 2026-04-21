import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const today = new Date().toISOString().slice(0, 10)

  try {
    // Find sessions for today that have check_in_at but no check_out_at
    // and are still in PRESENT or EXPECTED status
    const { data: incompleteSessions, error: fetchErr } = await supabase
      .from('attendance_sessions')
      .select('id, enrollment_id, branch_id, check_in_at')
      .eq('session_date', today)
      .not('check_in_at', 'is', null)
      .is('check_out_at', null)
      .in('status', ['PRESENT', 'EXPECTED'])

    if (fetchErr) throw fetchErr

    if (!incompleteSessions || incompleteSessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, flagged: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Mark each as PARTIAL
    const ids = incompleteSessions.map((s) => s.id)
    const { error: updateErr } = await supabase
      .from('attendance_sessions')
      .update({ status: 'PARTIAL' })
      .in('id', ids)

    if (updateErr) throw updateErr

    // Log each partial session to system_errors for DCU worker follow-up
    const errorRows = incompleteSessions.map((s) => ({
      branch_id: s.branch_id,
      source: 'session-reconcile',
      error_code: 'PARTIAL_SESSION',
      error_message: `Session ${s.id} has CHECK_IN at ${s.check_in_at} but no CHECK_OUT recorded for ${today}`,
      context: { session_id: s.id, enrollment_id: s.enrollment_id, session_date: today },
      resolved: false,
    }))

    await supabase.from('system_errors').insert(errorRows)

    console.log(`[session-reconcile] Flagged ${incompleteSessions.length} partial sessions for ${today}`)

    return new Response(
      JSON.stringify({ success: true, flagged: incompleteSessions.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[session-reconcile] Error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
