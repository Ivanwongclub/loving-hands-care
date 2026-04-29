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

    // Verify caller is BRANCH_ADMIN or SYSTEM_ADMIN
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
    const { contactId, portalEmail, residentId } = body as {
      contactId?: string
      portalEmail?: string
      residentId?: string
    }

    if (!contactId || !portalEmail || !residentId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: contactId, portalEmail, residentId' }),
        { status: 400, headers: CORS }
      )
    }

    // Validate resident + branch access
    const { data: resident, error: resErr } = await supabase
      .from('residents')
      .select('id, branch_id')
      .eq('id', residentId)
      .is('deleted_at', null)
      .maybeSingle()

    if (resErr || !resident) {
      return new Response(JSON.stringify({ error: 'Resident not found' }), { status: 404, headers: CORS })
    }

    if (
      caller.role === 'BRANCH_ADMIN' &&
      !(caller.branch_ids as string[]).includes(resident.branch_id)
    ) {
      return new Response(
        JSON.stringify({ error: 'Cannot invite for residents outside your branches' }),
        { status: 403, headers: CORS }
      )
    }

    // Validate contact belongs to that resident and has portal_email set
    const { data: contact, error: contactErr } = await supabase
      .from('resident_contacts')
      .select('id, resident_id, portal_email, auth_user_id')
      .eq('id', contactId)
      .maybeSingle()

    if (contactErr || !contact) {
      return new Response(JSON.stringify({ error: 'Contact not found' }), { status: 404, headers: CORS })
    }
    if (contact.resident_id !== residentId) {
      return new Response(
        JSON.stringify({ error: 'Contact does not belong to this resident' }),
        { status: 400, headers: CORS }
      )
    }

    // Determine redirect target
    const origin =
      req.headers.get('origin') ??
      req.headers.get('referer')?.replace(/\/[^/]*$/, '') ??
      ''
    const redirectTo = origin ? `${origin}/family/dashboard` : undefined

    // Send invitation magic link
    const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
      portalEmail,
      {
        redirectTo,
        data: { user_type: 'family_portal' },
      }
    )

    if (inviteErr || !inviteData?.user) {
      // If user already exists in auth, fall back to magic link generation
      const msg = inviteErr?.message ?? 'Invite failed'
      // Common case: "User already registered" — try OTP magic link instead
      if (msg.toLowerCase().includes('already')) {
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: portalEmail,
          options: { redirectTo },
        })
        if (linkErr || !linkData?.user) {
          return new Response(
            JSON.stringify({ error: linkErr?.message ?? 'Magic link generation failed' }),
            { status: 500, headers: CORS }
          )
        }
        const userId = linkData.user.id
        await supabase
          .from('resident_contacts')
          .update({ auth_user_id: userId })
          .eq('id', contactId)
        return new Response(
          JSON.stringify({ success: true, userId, email: portalEmail, mode: 'magiclink' }),
          { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(JSON.stringify({ error: msg }), { status: 500, headers: CORS })
    }

    const newUserId = inviteData.user.id

    // Link auth.users → resident_contacts
    const { error: updateErr } = await supabase
      .from('resident_contacts')
      .update({ auth_user_id: newUserId })
      .eq('id', contactId)

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: `Invitation sent but linking failed: ${updateErr.message}` }),
        { status: 500, headers: CORS }
      )
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUserId, email: portalEmail, mode: 'invite' }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[invite-family-portal-user]', (err as Error).message)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS }
    )
  }
})
