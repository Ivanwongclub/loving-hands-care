// Returns: system_jobs status, recent runs, notification stats, backup status.
// Auth: SYSTEM_ADMIN only.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      .select('role')
      .eq('supabase_auth_id', user.id)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .single()

    if (!caller || caller.role !== 'SYSTEM_ADMIN') {
      return new Response(JSON.stringify({ error: 'SYSTEM_ADMIN only' }), { status: 403, headers: CORS })
    }

    // Fetch system jobs with last 5 runs each
    const { data: jobs } = await supabase
      .from('system_jobs')
      .select(`
        *,
        recent_runs:system_job_runs(
          id, started_at, ended_at, status, message, duration_ms, triggered_by
        )
      `)
      .order('job_name')

    // Notification stats last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: notifStats } = await supabase
      .from('notification_log')
      .select('status')
      .gte('created_at', sevenDaysAgo)

    const delivered = notifStats?.filter(
      (r) => r.status === 'DELIVERED' || r.status === 'DELIVERED_FALLBACK'
    ).length ?? 0
    const failedNotif = notifStats?.filter((r) => r.status === 'FAILED').length ?? 0
    const total = notifStats?.length ?? 0
    const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : null

    // Backup status — last 10 entries
    const { data: lastBackups } = await supabase
      .from('backup_log')
      .select('backup_type, status, started_at, completed_at, file_size_bytes, error_message')
      .order('started_at', { ascending: false })
      .limit(10)

    return new Response(
      JSON.stringify({
        jobs,
        notification_health: {
          delivered,
          failed: failedNotif,
          total,
          delivery_rate_pct: deliveryRate,
          period_days: 7,
        },
        backup_history: lastBackups ?? [],
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[get-system-health]', (err as Error).message)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS }
    )
  }
})
