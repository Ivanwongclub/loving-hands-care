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
      .select('id, role, branch_ids')
      .eq('supabase_auth_id', user.id)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .single()

    if (!caller || !['SYSTEM_ADMIN', 'BRANCH_ADMIN', 'SENIOR_NURSE'].includes(caller.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS })
    }

    const { staff_id } = await req.json()
    if (!staff_id) {
      return new Response(JSON.stringify({ error: 'staff_id required' }), { status: 400, headers: CORS })
    }

    const { data: target } = await supabase
      .from('staff')
      .select('id, branch_ids')
      .eq('id', staff_id)
      .single()

    if (!target) {
      return new Response(JSON.stringify({ error: 'Staff not found' }), { status: 404, headers: CORS })
    }

    if (caller.role !== 'SYSTEM_ADMIN') {
      const hasAccess = (target.branch_ids as string[]).some(
        (b: string) => (caller.branch_ids as string[]).includes(b)
      )
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: 'No branch access' }), { status: 403, headers: CORS })
      }
    }

    await supabase.from('staff').update({
      pin_hash: null,
      pin_failed_attempts: 0,
      pin_locked_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', staff_id)

    await supabase.from('audit_logs').insert({
      branch_id: (target.branch_ids as string[])[0],
      actor_id: caller.id,
      actor_role: caller.role,
      action: 'STAFF_PIN_RESET',
      entity_type: 'staff',
      entity_id: staff_id,
      category: 'AUTH',
      after_state: { pin_hash: null },
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[admin-reset-pin]', (err as Error).message)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS }
    )
  }
})
