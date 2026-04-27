// Called by pg_cron every 2 minutes.
// MOCK MODE: marks all as delivered with provider_ref='MOCK-{uuid}'.
// Real WhatsApp/SMS integration is Phase 2.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const start = Date.now()
  const runId = crypto.randomUUID()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  await supabase.from('system_job_runs').insert({
    id: runId,
    job_name: 'process-notification-queue',
    started_at: new Date().toISOString(),
    status: 'RUNNING',
    triggered_by: 'CRON',
  }).catch(console.error)

  try {
    const { data: pending, error } = await supabase
      .from('notification_queue')
      .select('*')
      .in('status', ['PENDING', 'FALLBACK_PENDING'])
      .lte('next_attempt_at', new Date().toISOString())
      .lt('attempt_count', 10)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) throw error

    let processed = 0
    let failed = 0

    for (const item of pending ?? []) {
      try {
        const mockRef = `MOCK-${crypto.randomUUID().slice(0, 8)}`
        const recipientMasked = item.recipient_phone
          ? `${String(item.recipient_phone).slice(0, 4)}****${String(item.recipient_phone).slice(-4)}`
          : item.recipient_email?.replace(/(.{2}).+(@.+)/, '$1****$2') ?? '—'

        await supabase.from('notification_log').insert({
          branch_id: item.branch_id,
          resident_id: item.resident_id,
          event_type: item.event_type,
          channel: item.channel,
          recipient_masked: recipientMasked,
          message_preview: String(item.message).slice(0, 50),
          status: 'DELIVERED',
          provider_ref: mockRef,
          attempt_count: item.attempt_count + 1,
          sent_at: new Date().toISOString(),
          delivered_at: new Date().toISOString(),
        })

        await supabase.from('notification_queue').delete().eq('id', item.id)
        processed++

      } catch (itemErr) {
        console.error('[process-notification-queue] item failed:', item.id, itemErr)
        const newAttempts = item.attempt_count + 1

        if (newAttempts >= item.max_attempts) {
          await supabase.from('notification_log').insert({
            branch_id: item.branch_id,
            resident_id: item.resident_id,
            event_type: item.event_type,
            channel: item.channel,
            recipient_masked: '—',
            message_preview: String(item.message).slice(0, 50),
            status: 'FAILED',
            failure_reason: (itemErr as Error).message,
            attempt_count: newAttempts,
          })
          await supabase.from('notification_queue').delete().eq('id', item.id)
          failed++
        } else {
          const retryAt = new Date(Date.now() + 60_000 * newAttempts)
          await supabase.from('notification_queue').update({
            attempt_count: newAttempts,
            next_attempt_at: retryAt.toISOString(),
            last_error: (itemErr as Error).message,
          }).eq('id', item.id)
        }
      }
    }

    const msg = `Processed ${processed} notifications. Failed: ${failed}.`
    const durationMs = Date.now() - start

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
      }).eq('job_name', 'process-notification-queue'),
      supabase.rpc('increment_system_job_counter', {
        p_job_name: 'process-notification-queue',
        p_success: true,
      }),
    ]).catch(console.error)

    return new Response(JSON.stringify({ success: true, processed, failed }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const durationMs = Date.now() - start
    const errMsg = (err as Error).message

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
      }).eq('job_name', 'process-notification-queue'),
      supabase.rpc('increment_system_job_counter', {
        p_job_name: 'process-notification-queue',
        p_success: false,
      }),
    ]).catch(console.error)

    console.error('[process-notification-queue] Fatal:', errMsg)
    return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: CORS })
  }
})
