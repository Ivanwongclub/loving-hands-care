// SYSTEM_ADMIN only.
// Body: { job_name, new_schedule_utc, new_schedule_hkt_label, new_schedule_hkt_label_zh }
// Validates cron expression, respects min_interval_minutes, calls reschedule_job RPC,
// updates system_jobs, and writes audit log.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isValidCron(expr: string): boolean {
  return expr.trim().split(/\s+/).length === 5
}

function estimateMinIntervalMins(expr: string): number {
  const minute = expr.trim().split(/\s+/)[0]
  if (minute.startsWith('*/')) return parseInt(minute.slice(2), 10)
  if (minute === '*') return 1
  return 60
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
    }

    const { data: caller } = await supabase
      .from('staff')
      .select('id, role')
      .eq('supabase_auth_id', user.id)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .single()

    if (!caller || caller.role !== 'SYSTEM_ADMIN') {
      return new Response(JSON.stringify({ error: 'SYSTEM_ADMIN only' }), { status: 403, headers: CORS })
    }

    const {
      job_name,
      new_schedule_utc,
      new_schedule_hkt_label,
      new_schedule_hkt_label_zh,
    } = await req.json()

    if (!job_name || !new_schedule_utc) {
      return new Response(
        JSON.stringify({ error: 'job_name and new_schedule_utc required' }),
        { status: 400, headers: CORS }
      )
    }

    if (!isValidCron(new_schedule_utc)) {
      return new Response(
        JSON.stringify({ error: 'Invalid cron expression — must have 5 space-separated fields' }),
        { status: 400, headers: CORS }
      )
    }

    const { data: job } = await supabase
      .from('system_jobs')
      .select('*')
      .eq('job_name', job_name)
      .single()

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: CORS })
    }

    if (!job.is_schedule_editable) {
      return new Response(
        JSON.stringify({ error: 'This job schedule cannot be edited' }),
        { status: 400, headers: CORS }
      )
    }

    if (job.min_interval_minutes) {
      const estimated = estimateMinIntervalMins(new_schedule_utc)
      if (estimated < job.min_interval_minutes) {
        return new Response(
          JSON.stringify({
            error: `Schedule too frequent. Minimum interval: ${job.min_interval_minutes} minutes`,
          }),
          { status: 400, headers: CORS }
        )
      }
    }

    const oldSchedule = job.schedule_utc

    // Reschedule in pg_cron via SECURITY DEFINER RPC
    const { error: rpcError } = await supabase.rpc('reschedule_job', {
      p_job_name: job_name,
      p_schedule: new_schedule_utc,
      p_command: job.cron_command,
    })

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: `pg_cron reschedule failed: ${rpcError.message}` }),
        { status: 500, headers: CORS }
      )
    }

    await supabase.from('system_jobs').update({
      schedule_utc: new_schedule_utc,
      schedule_hkt_label: new_schedule_hkt_label ?? new_schedule_utc,
      schedule_hkt_label_zh: new_schedule_hkt_label_zh ?? new_schedule_utc,
      updated_at: new Date().toISOString(),
    }).eq('job_name', job_name)

    await supabase.from('audit_logs').insert({
      branch_id: null,
      actor_id: caller.id,
      actor_role: caller.role,
      action: 'SYSTEM_JOB_SCHEDULE_CHANGED',
      entity_type: 'system_job',
      entity_id: job.id,
      category: 'SYSTEM_JOB',
      before_state: { schedule_utc: oldSchedule },
      after_state: { schedule_utc: new_schedule_utc },
    })

    return new Response(
      JSON.stringify({ success: true, job_name, new_schedule_utc }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[update-job-schedule]', (err as Error).message)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS }
    )
  }
})
