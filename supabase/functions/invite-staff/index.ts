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

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
    }

    const { data: caller } = await supabase
      .from('staff')
      .select('id, role, branch_ids, status')
      .eq('supabase_auth_id', user.id)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .single()

    if (!caller || !['SYSTEM_ADMIN', 'BRANCH_ADMIN'].includes(caller.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS })
    }

    const body = await req.json()
    const { name, name_zh, email, role, branch_ids, temp_password, is_shared_device } = body

    if (!name || !email || !role || !branch_ids?.length || !temp_password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, email, role, branch_ids, temp_password' }),
        { status: 400, headers: CORS }
      )
    }

    // BRANCH_ADMIN cannot create SYSTEM_ADMIN or BRANCH_ADMIN
    if (caller.role === 'BRANCH_ADMIN' && ['SYSTEM_ADMIN', 'BRANCH_ADMIN'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions to create this role' }),
        { status: 403, headers: CORS }
      )
    }

    // BRANCH_ADMIN can only assign their own branches
    if (caller.role === 'BRANCH_ADMIN') {
      const unauthorised = (branch_ids as string[]).filter(
        (id: string) => !(caller.branch_ids as string[]).includes(id)
      )
      if (unauthorised.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Cannot assign branches outside your access' }),
          { status: 403, headers: CORS }
        )
      }
    }

    // Check email not already in staff
    const { data: existing } = await supabase
      .from('staff')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Email already exists in staff records' }),
        { status: 409, headers: CORS }
      )
    }

    // Create Supabase Auth user
    const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: temp_password,
      email_confirm: true,
    })
    if (createError || !authUser.user) {
      return new Response(
        JSON.stringify({ error: createError?.message ?? 'Failed to create auth user' }),
        { status: 500, headers: CORS }
      )
    }

    // Insert staff record
    const { data: newStaff, error: staffError } = await supabase
      .from('staff')
      .insert({
        name,
        name_zh: name_zh ?? null,
        email,
        role,
        branch_ids,
        status: 'ACTIVE',
        supabase_auth_id: authUser.user.id,
        is_shared_device: is_shared_device ?? false,
        pin_failed_attempts: 0,
      })
      .select()
      .single()

    if (staffError) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return new Response(
        JSON.stringify({ error: staffError.message }),
        { status: 500, headers: CORS }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      branch_id: branch_ids[0],
      actor_id: caller.id,
      actor_role: caller.role,
      action: 'STAFF_INVITED',
      entity_type: 'staff',
      entity_id: newStaff.id,
      category: 'USER_ACTIVITY',
      after_state: { email, role, branch_ids, is_shared_device: is_shared_device ?? false },
    })

    return new Response(JSON.stringify({ staff: newStaff }), {
      status: 201,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[invite-staff]', (err as Error).message)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS }
    )
  }
})
