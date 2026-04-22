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

  try {
    // Fetch all branches with their SLA config
    const { data: branches, error: branchErr } = await supabase
      .from('branches')
      .select('id, sla_config')
      .eq('is_active', true)

    if (branchErr) throw branchErr

    let totalEscalated = 0

    for (const branch of branches ?? []) {
      const sla = readSLA(branch.sla_config)

      // Fetch OPEN and ACKNOWLEDGED alerts for this branch
      // that have not been resolved or dismissed
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

        // Determine if this alert should escalate based on its current level
        // and how long it has been open
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
        // Level 3 is max — no further auto-escalation

        if (!shouldEscalate) continue

        const nowIso = new Date().toISOString()

        // Update the alert
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

        // Insert escalation history record
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

        // Insert audit log entry
        await supabase.from('audit_logs').insert({
          branch_id: branch.id,
          actor_id: null,
          actor_role: 'SYSTEM',
          action: 'ALERT_AUTO_ESCALATED',
          entity_type: 'alerts',
          entity_id: alert.id,
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

    return new Response(
      JSON.stringify({ success: true, escalated: totalEscalated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[escalation-worker] Fatal error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
