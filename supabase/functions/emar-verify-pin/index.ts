import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

interface VerifyPINRequest {
  staff_id: string
  pin: string
  emar_record_id: string
}

interface VerifyPINResponse {
  success: boolean
  locked: boolean
  message?: string
}

interface StaffPINRecord {
  id: string
  pin_hash: string | null
  pin_failed_attempts: number | null
  pin_locked_at: string | null
  status: string
  role: string
}

const MAX_ATTEMPTS = 3
const UPDATE_RETRY_LIMIT = 5
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: VerifyPINResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function fetchStaffRecord(
  supabase: ReturnType<typeof createClient>,
  staffId: string,
): Promise<StaffPINRecord | null> {
  const { data, error } = await supabase
    .from('staff')
    .select('id, pin_hash, pin_failed_attempts, pin_locked_at, status, role')
    .eq('id', staffId)
    .eq('status', 'ACTIVE')
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return data as StaffPINRecord
}

async function incrementFailureCount(
  supabase: ReturnType<typeof createClient>,
  staff: StaffPINRecord,
): Promise<{ locked: boolean; attempts: number }> {
  let currentStaff = staff

  // Use optimistic concurrency so simultaneous bad PIN attempts do not overwrite each other.
  for (let retry = 0; retry < UPDATE_RETRY_LIMIT; retry += 1) {
    if (currentStaff.pin_locked_at) {
      return {
        locked: true,
        attempts: currentStaff.pin_failed_attempts ?? MAX_ATTEMPTS,
      }
    }

    const currentAttempts = currentStaff.pin_failed_attempts ?? 0
    const nextAttempts = currentAttempts + 1
    const shouldLock = nextAttempts >= MAX_ATTEMPTS

    let updateQuery = supabase
      .from('staff')
      .update({
        pin_failed_attempts: nextAttempts,
        pin_locked_at: shouldLock ? new Date().toISOString() : null,
      })
      .eq('id', currentStaff.id)
      .eq('pin_failed_attempts', currentAttempts)

    updateQuery = currentStaff.pin_locked_at
      ? updateQuery.eq('pin_locked_at', currentStaff.pin_locked_at)
      : updateQuery.is('pin_locked_at', null)

    const { data: updatedRows, error: updateErr } = await updateQuery.select('id').limit(1)
    if (updateErr) throw updateErr

    if (updatedRows && updatedRows.length > 0) {
      return { locked: shouldLock, attempts: nextAttempts }
    }

    const latestStaff = await fetchStaffRecord(supabase, currentStaff.id)
    if (!latestStaff) {
      throw new Error('Staff record disappeared during PIN verification')
    }
    currentStaff = latestStaff
  }

  throw new Error('Unable to update PIN failure count safely')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body: VerifyPINRequest = await req.json()
    const { staff_id, pin, emar_record_id } = body

    if (!staff_id || !pin || !emar_record_id) {
      return jsonResponse({ success: false, locked: false, message: 'Missing required fields' }, 400)
    }

    if (!/^\d{4}$/.test(pin)) {
      return jsonResponse({ success: false, locked: false, message: 'Invalid PIN format' }, 400)
    }

    const staff = await fetchStaffRecord(supabase, staff_id)
    if (!staff) {
      return jsonResponse({ success: false, locked: false, message: 'Staff not found' }, 404)
    }

    if (staff.pin_locked_at) {
      return jsonResponse({ success: false, locked: true, message: 'PIN locked - contact supervisor' })
    }

    const clinicalRoles = ['SENIOR_NURSE', 'NURSE', 'BRANCH_ADMIN', 'SYSTEM_ADMIN']
    if (!clinicalRoles.includes(staff.role)) {
      return jsonResponse({
        success: false,
        locked: false,
        message: 'Insufficient role for medication administration',
      }, 403)
    }

    if (!staff.pin_hash) {
      return jsonResponse({
        success: false,
        locked: false,
        message: 'PIN not configured - contact administrator',
      })
    }

    const pinValid = await bcrypt.compare(pin, staff.pin_hash)

    if (pinValid) {
      await supabase
        .from('staff')
        .update({ pin_failed_attempts: 0, pin_locked_at: null })
        .eq('id', staff_id)

      await supabase
        .from('emar_records')
        .update({ shift_pin_verified: true })
        .eq('id', emar_record_id)

      console.log(`[emar-verify-pin] PIN verified for staff ${staff_id}, emar_record ${emar_record_id}`)
      return jsonResponse({ success: true, locked: false })
    }

    const failureState = await incrementFailureCount(supabase, staff)
    console.log(`[emar-verify-pin] Failed attempt ${failureState.attempts}/${MAX_ATTEMPTS} for staff ${staff_id}`)

    return jsonResponse({
      success: false,
      locked: failureState.locked,
      message: failureState.locked
        ? 'PIN locked after 3 failed attempts - contact supervisor'
        : `Incorrect PIN (${failureState.attempts}/${MAX_ATTEMPTS} attempts)`,
    })
  } catch (err) {
    console.error('[emar-verify-pin] Unexpected error:', (err as Error).message)
    return jsonResponse({ success: false, locked: false, message: 'Internal server error' }, 500)
  }
})
