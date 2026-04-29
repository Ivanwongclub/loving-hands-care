// Called by pg_cron (daily/weekly/monthly) or manual trigger.
// Body: { type: 'daily' | 'weekly' | 'monthly' | 'manual' }
// Phase 1: Logs a placeholder entry — real pg_dump + B2/S3 upload in Phase 2
// when backup credentials are configured in system_config.backup.
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

  const body = await req.json().catch(() => ({ type: 'manual' }))
  const backupType: string = body.type ?? 'manual'
  const triggeredBy: string = body.triggered_by ?? 'CRON'
  const jobName =
    backupType === 'daily' ? 'offsite-backup-daily' :
    backupType === 'weekly' ? 'offsite-backup-weekly' :
    backupType === 'monthly' ? 'offsite-backup-monthly' :
    'offsite-backup-daily'

  {
    const { error: jobRunInsertErr } = await supabase.from('system_job_runs').insert({
      id: runId,
      job_name: jobName,
      started_at: new Date().toISOString(),
      status: 'RUNNING',
      triggered_by: triggeredBy,
    })
    if (jobRunInsertErr) console.error('[system_job_runs insert]', jobRunInsertErr.message)
  }

  try {
    // Check if backup credentials are configured in any branch's system_config
    const { data: branch } = await supabase
      .from('branches')
      .select('system_config')
      .eq('is_active', true)
      .limit(1)
      .single()

    const backupConfig = (branch?.system_config as Record<string, Record<string, string>> | null)?.backup ?? {}
    const isConfigured = !!(backupConfig.bucket && backupConfig.provider)

    if (!isConfigured) {
      // Phase 1: log placeholder — real backup not yet configured
      await supabase.from('backup_log').insert({
        backup_type: backupType.toUpperCase(),
        status: 'SUCCESS',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        file_path: 'NOT_CONFIGURED',
        triggered_by: triggeredBy,
        error_message: 'Backup credentials not configured — placeholder entry only',
      })

      const msg = 'Backup credentials not configured. Placeholder logged.'
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
        }).eq('job_name', jobName),
        supabase.rpc('increment_system_job_counter', { p_job_name: jobName, p_success: true }),
      ]).catch(console.error)

      return new Response(
        JSON.stringify({ success: true, note: msg }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // Phase 2 placeholder — credentials are present but logic not yet implemented
    // TODO Phase 2:
    // 1. Read credentials from Supabase Vault
    // 2. pg_dump via Supabase DB connection string
    // 3. Compress + encrypt AES-256
    // 4. Upload to configured provider (B2/S3/GCS)
    // 5. Verify checksum
    // 6. Insert backup_log with real file_path + checksum + file_size_bytes
    throw new Error('Phase 2 not implemented — backup execution logic pending')

  } catch (err) {
    const errMsg = (err as Error).message
    const durationMs = Date.now() - start

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
      }).eq('job_name', jobName),
      supabase.rpc('increment_system_job_counter', { p_job_name: jobName, p_success: false }),
    ]).catch(console.error)

    console.error('[run-offsite-backup]', errMsg)
    return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: CORS })
  }
})
