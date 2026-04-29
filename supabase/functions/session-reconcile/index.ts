import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const today = new Date().toISOString().slice(0, 10)
  const runId = crypto.randomUUID()
  const startMs = Date.now()

  {
    const { error: jobRunInsertErr } = await supabase.from('system_job_runs').insert({
      id: runId,
      job_name: 'session-reconcile',
      started_at: new Date().toISOString(),
      status: 'RUNNING',
      triggered_by: 'CRON',
    })
    if (jobRunInsertErr) console.error('[system_job_runs insert]', jobRunInsertErr.message)
  }

  try {
    const { data: incompleteSessions, error: fetchErr } = await supabase
      .from('attendance_sessions')
      .select('id, enrollment_id, branch_id, check_in_at')
      .eq('session_date', today)
      .not('check_in_at', 'is', null)
      .is('check_out_at', null)
      .in('status', ['PRESENT', 'EXPECTED'])

    if (fetchErr) throw fetchErr

    if (!incompleteSessions || incompleteSessions.length === 0) {
      const durationMs = Date.now() - startMs
      const msg = 'No partial sessions found'

      await Promise.all([
        supabase.from('system_job_runs').update({
          ended_at: new Date().toISOString(),
          status: 'SUCCESS',
          message: msg,
          duration_ms: durationMs,
        }).eq('id', runId),
        supabase.from('system_jobs').update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'SUCCESS',
          last_run_message: msg,
          last_run_ms: durationMs,
        }).eq('job_name', 'session-reconcile'),
        supabase.rpc('increment_system_job_counter', { p_job_name: 'session-reconcile', p_success: true }),
      ]).catch(console.error)

      return new Response(
        JSON.stringify({ success: true, flagged: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const ids = incompleteSessions.map((s) => s.id)
    const { error: updateErr } = await supabase
      .from('attendance_sessions')
      .update({ status: 'PARTIAL' })
      .in('id', ids)

    if (updateErr) throw updateErr

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

    const durationMs = Date.now() - startMs
    const msg = `Flagged ${incompleteSessions.length} partial sessions`

    await Promise.all([
      supabase.from('system_job_runs').update({
        ended_at: new Date().toISOString(),
        status: 'SUCCESS',
        message: msg,
        duration_ms: durationMs,
      }).eq('id', runId),
      supabase.from('system_jobs').update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'SUCCESS',
        last_run_message: msg,
        last_run_ms: durationMs,
      }).eq('job_name', 'session-reconcile'),
      supabase.rpc('increment_system_job_counter', { p_job_name: 'session-reconcile', p_success: true }),
    ]).catch(console.error)

    return new Response(
      JSON.stringify({ success: true, flagged: incompleteSessions.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const errMsg = String(err)
    const durationMs = Date.now() - startMs

    await Promise.all([
      supabase.from('system_job_runs').update({
        ended_at: new Date().toISOString(),
        status: 'FAILED',
        message: errMsg,
        duration_ms: durationMs,
      }).eq('id', runId),
      supabase.from('system_jobs').update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'FAILED',
        last_run_message: errMsg,
        last_run_ms: durationMs,
      }).eq('job_name', 'session-reconcile'),
      supabase.rpc('increment_system_job_counter', { p_job_name: 'session-reconcile', p_success: false }),
    ]).catch(console.error)

    console.error('[session-reconcile] Error:', err)
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
