import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SLAConfig {
  alert_escalation_l1_minutes?: number
  alert_escalation_l2_minutes?: number
  alert_escalation_l3_minutes?: number
}

const DEFAULT_SLA: SLAConfig = {
  alert_escalation_l1_minutes: 60,
  alert_escalation_l2_minutes: 120,
  alert_escalation_l3_minutes: 240,
}

function readSLA(raw: unknown): Required<SLAConfig> {
  const cfg = (raw ?? {}) as SLAConfig
  return {
    alert_escalation_l1_minutes: cfg.alert_escalation_l1_minutes ?? DEFAULT_SLA.alert_escalation_l1_minutes!,
    alert_escalation_l2_minutes: cfg.alert_escalation_l2_minutes ?? DEFAULT_SLA.alert_escalation_l2_minutes!,
    alert_escalation_l3_minutes: cfg.alert_escalation_l3_minutes ?? DEFAULT_SLA.alert_escalation_l3_minutes!,
  }
}

function minutesSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60000
}

serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const runId = crypto.randomUUID()
  const startMs = Date.now()

  {
    const { error: jobRunInsertErr } = await supabase.from('system_job_runs').insert({
      id: runId,
      job_name: 'alert-escalation-worker',
      started_at: new Date().toISOString(),
      status: 'RUNNING',
      triggered_by: 'CRON',
    })
    if (jobRunInsertErr) console.error('[system_job_runs insert]', jobRunInsertErr.message)
  }

  try {
    const { data: branches, error: branchErr } = await supabase
      .from('branches')
      .select('id, sla_config')
      .eq('is_active', true)

    if (branchErr) throw branchErr

    let totalEscalated = 0

    for (const branch of branches ?? []) {
      const sla = readSLA(branch.sla_config)

      const { data: alerts, error: alertErr } = await supabase
        .from('alerts')
        .select('id, status, escalation_level, triggered_at, last_escalated_at')
        .eq('branch_id', branch.id)
        .in('status', ['OPEN', 'ACKNOWLEDGED'])
        .order('triggered_at', { ascending: true })

      if (alertErr) {
        console.error(`[escalation-worker] Error fetching alerts for branch ${branch.id}:`, alertErr.message)
        continue
      }

      for (const alert of alerts ?? []) {
        const currentLevel = alert.escalation_level ?? 0
        const elapsed = minutesSince(alert.triggered_at)

        let shouldEscalate = false
        let newLevel = currentLevel

        if (currentLevel === 0 && elapsed >= sla.alert_escalation_l1_minutes) {
          shouldEscalate = true
          newLevel = 1
        } else if (currentLevel === 1 && elapsed >= sla.alert_escalation_l2_minutes) {
          shouldEscalate = true
          newLevel = 2
        } else if (currentLevel === 2 && elapsed >= sla.alert_escalation_l3_minutes) {
          shouldEscalate = true
          newLevel = 3
        }

        if (!shouldEscalate) continue

        const nowIso = new Date().toISOString()

        const { error: updateErr } = await supabase
          .from('alerts')
          .update({
            escalation_level: newLevel,
            last_escalated_at: nowIso,
            status: alert.status === 'OPEN' ? 'ACKNOWLEDGED' : alert.status,
          })
          .eq('id', alert.id)

        if (updateErr) {
          console.error(`[escalation-worker] Failed to update alert ${alert.id}:`, updateErr.message)
          continue
        }

        const { error: escalErr } = await supabase
          .from('alert_escalations')
          .insert({
            alert_id: alert.id,
            escalated_at: nowIso,
            from_level: currentLevel,
            to_level: newLevel,
            reason: `Auto-escalated by system: SLA L${newLevel} threshold exceeded (${Math.round(elapsed)} minutes elapsed)`,
            notified_staff: [],
            channel: null,
          })

        if (escalErr) {
          console.error(`[escalation-worker] Failed to insert escalation for alert ${alert.id}:`, escalErr.message)
        }

        await supabase.from('audit_logs').insert({
          branch_id: branch.id,
          actor_id: null,
          actor_role: 'SYSTEM',
          action: 'ALERT_AUTO_ESCALATED',
          entity_type: 'alerts',
          entity_id: alert.id,
          category: 'SYSTEM_JOB',
          before_state: { escalation_level: currentLevel, status: alert.status },
          after_state: { escalation_level: newLevel, last_escalated_at: nowIso },
          metadata: {
            elapsed_minutes: Math.round(elapsed),
            sla_threshold: newLevel === 1
              ? sla.alert_escalation_l1_minutes
              : newLevel === 2
              ? sla.alert_escalation_l2_minutes
              : sla.alert_escalation_l3_minutes,
          },
        })

        totalEscalated++
        console.log(`[escalation-worker] Auto-escalated alert ${alert.id} to level ${newLevel} (${Math.round(elapsed)}min elapsed)`)
      }
    }

    const durationMs = Date.now() - startMs
    const msg = `Escalated ${totalEscalated} alerts`

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
      }).eq('job_name', 'alert-escalation-worker'),
      supabase.rpc('increment_system_job_counter', {
        p_job_name: 'alert-escalation-worker',
        p_success: true,
      }),
    ]).catch(console.error)

    return new Response(
      JSON.stringify({ success: true, escalated: totalEscalated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const errMsg = (err as Error).message
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
      }).eq('job_name', 'alert-escalation-worker'),
      supabase.rpc('increment_system_job_counter', {
        p_job_name: 'alert-escalation-worker',
        p_success: false,
      }),
    ]).catch(console.error)

    console.error('[escalation-worker] Fatal error:', errMsg)
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
