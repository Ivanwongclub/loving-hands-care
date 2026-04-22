import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as xlsx from 'https://esm.sh/xlsx@0.18.5'

interface ReportRequest {
  report_type: 'dcuAttendance' | 'residentCensus' | 'emarCompliance' | 'incidentSummary'
  branch_id: string
  from_date: string  // YYYY-MM-DD
  to_date: string    // YYYY-MM-DD
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Traditional Chinese column headers per SWD format
const HEADERS = {
  dcuAttendance: ['日期', '院友姓名', '身份證參考', '出席類型', '時間', '記錄方式', '備註'],
  residentCensus: ['院友姓名', '身份證參考', '入住日期', '離院日期', '床位', '狀態', '照顧計劃狀態'],
  emarCompliance: ['院友姓名', '身份證參考', '藥物名稱', '劑量', '應給時間', '實際給藥時間', '給藥人員', '條碼核實', 'PIN核實', '狀態'],
  incidentSummary: ['事故編號', '院友姓名', '身份證參考', '事故類型', '嚴重程度', '事發時間', '結案時間', '跟進次數', '狀態'],
}

const REPORT_TITLES = {
  dcuAttendance: '日間護理中心出席記錄',
  residentCensus: '院友人口統計報表',
  emarCompliance: '電子用藥記錄合規報表',
  incidentSummary: '事故報告摘要',
}

function hkidRef(hash: string | null): string {
  if (!hash || hash.length < 4) return '—'
  return hash.slice(-4)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function bool(v: boolean | null): string {
  return v ? '是' : '否'
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

    const body: ReportRequest = await req.json()
    const { report_type, branch_id, from_date, to_date } = body

    if (!report_type || !branch_id || !from_date || !to_date) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const wb = xlsx.utils.book_new()
    const fromISO = `${from_date}T00:00:00`
    const toISO = `${to_date}T23:59:59`

    // Title row style
    const title = REPORT_TITLES[report_type]
    const period = `報告期間：${from_date} 至 ${to_date}`
    const generated = `生成時間：${fmtDateTime(new Date().toISOString())}`
    const swdNote = '社會福利署呈報用途'

    let rows: unknown[][] = []

    if (report_type === 'dcuAttendance') {
      const { data, error } = await supabase
        .from('attendance_events')
        .select(`
          id, event_type, event_time, operator_type, is_manual,
          dcu_enrollments:enrollment_id(
            residents:resident_id(name_zh, name, hkid_hash)
          )
        `)
        .eq('branch_id', branch_id)
        .gte('event_time', fromISO)
        .lte('event_time', toISO)
        .order('event_time', { ascending: true })
        .limit(5000)

      if (error) throw error

      rows = (data ?? []).map((r: any) => {
        const enr = Array.isArray(r.dcu_enrollments) ? r.dcu_enrollments[0] : r.dcu_enrollments
        const resident = enr ? (Array.isArray(enr.residents) ? enr.residents[0] : enr.residents) : null
        return [
          fmtDate(r.event_time),
          resident?.name_zh || resident?.name || '—',
          hkidRef(resident?.hkid_hash),
          r.event_type === 'CHECK_IN' ? '簽到' : '簽退',
          fmtDateTime(r.event_time),
          r.is_manual || r.operator_type === 'STAFF_MANUAL' ? '人工記錄' : 'QR 掃描',
          r.operator_type === 'STAFF_MANUAL' ? '需 SWD 核實' : '',
        ]
      })
    }

    else if (report_type === 'residentCensus') {
      const { data, error } = await supabase
        .from('residents')
        .select(`
          id, name_zh, name, status, admission_date, discharge_date, hkid_hash,
          bed:bed_id(code, name, name_zh),
          icps(status, created_at)
        `)
        .eq('branch_id', branch_id)
        .lte('admission_date', to_date)
        .order('admission_date', { ascending: true })
        .limit(1000)

      if (error) throw error

      const STATUS_ZH: Record<string, string> = {
        ADMITTED: '在院', DISCHARGED: '已出院', LOA: '暫時外出', DECEASED: '已離世',
      }
      const ICP_ZH: Record<string, string> = {
        ACTIVE: '生效中', DRAFT: '草稿', PENDING_APPROVAL: '待審批',
        REJECTED: '已拒絕', SUPERSEDED: '已取代',
      }

      rows = (data ?? []).map((r: any) => {
        const icpArr = (r.icps ?? []).sort((a: any, b: any) =>
          (b.created_at || '').localeCompare(a.created_at || ''))
        const latestICP = icpArr[0]?.status ?? null
        const bed = Array.isArray(r.bed) ? r.bed[0] : r.bed
        return [
          r.name_zh || r.name,
          hkidRef(r.hkid_hash),
          fmtDate(r.admission_date),
          fmtDate(r.discharge_date),
          bed?.name_zh || bed?.name || bed?.code || '—',
          STATUS_ZH[r.status] || r.status,
          latestICP ? (ICP_ZH[latestICP] || latestICP) : '未有計劃',
        ]
      })
    }

    else if (report_type === 'emarCompliance') {
      const { data, error } = await supabase
        .from('emar_records')
        .select(`
          id, status, due_at, administered_at, barcode_verified, shift_pin_verified,
          resident:resident_id(name_zh, name, hkid_hash),
          order:order_id(drug_name, drug_name_zh, dose),
          administrator:administered_by(name, name_zh)
        `)
        .eq('branch_id', branch_id)
        .gte('due_at', fromISO)
        .lte('due_at', toISO)
        .order('due_at', { ascending: true })
        .limit(5000)

      if (error) throw error

      const STATUS_ZH: Record<string, string> = {
        ADMINISTERED: '已給藥', MISSED: '漏服', REFUSED: '拒絕服藥',
        LATE: '逾期', HELD: '暫緩', DUE: '待給藥',
      }

      rows = (data ?? []).map((r: any) => {
        const res = Array.isArray(r.resident) ? r.resident[0] : r.resident
        const ord = Array.isArray(r.order) ? r.order[0] : r.order
        const adm = Array.isArray(r.administrator) ? r.administrator[0] : r.administrator
        return [
          res?.name_zh || res?.name || '—',
          hkidRef(res?.hkid_hash),
          ord?.drug_name_zh || ord?.drug_name || '—',
          ord?.dose || '—',
          fmtDateTime(r.due_at),
          fmtDateTime(r.administered_at),
          adm?.name_zh || adm?.name || '—',
          bool(r.barcode_verified),
          bool(r.shift_pin_verified),
          STATUS_ZH[r.status] || r.status,
        ]
      })

      // Append compliance summary at the end
      const administered = rows.filter((r: any) => r[9] === '已給藥').length
      const missed = rows.filter((r: any) => r[9] === '漏服').length
      const refused = rows.filter((r: any) => r[9] === '拒絕服藥').length
      const late = rows.filter((r: any) => r[9] === '逾期').length
      const denom = administered + missed + refused + late
      const rate = denom > 0 ? Math.round((administered / denom) * 100) : 0
      rows.push([])
      rows.push(['合規摘要', '', '', '', '', '', '', '', '', ''])
      rows.push(['應給藥總次數', denom, '', '', '', '', '', '', '', ''])
      rows.push(['已給藥', administered, '', '', '', '', '', '', '', ''])
      rows.push(['漏服', missed, '', '', '', '', '', '', '', ''])
      rows.push(['拒絕服藥', refused, '', '', '', '', '', '', '', ''])
      rows.push(['依從率', `${rate}%`, '', '', '', '', '', '', '', ''])
    }

    else if (report_type === 'incidentSummary') {
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          id, incident_ref, type, severity, status, occurred_at, closed_at,
          resident:resident_id(name_zh, name, hkid_hash),
          followups:incident_followups(id)
        `)
        .eq('branch_id', branch_id)
        .gte('occurred_at', fromISO)
        .lte('occurred_at', toISO)
        .order('occurred_at', { ascending: true })
        .limit(1000)

      if (error) throw error

      const TYPE_ZH: Record<string, string> = {
        FALL: '跌倒', MEDICATION_ERROR: '藥物事故', BEHAVIOUR: '行為事故',
        MEDICAL_EMERGENCY: '醫療緊急事故', EQUIPMENT: '設備事故', OTHER: '其他',
      }
      const SEV_ZH: Record<string, string> = {
        LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '緊急',
      }
      const STATUS_ZH: Record<string, string> = {
        OPEN: '待處理', UNDER_REVIEW: '審查中', CLOSED: '已關閉',
      }

      rows = (data ?? []).map((r: any) => {
        const res = Array.isArray(r.resident) ? r.resident[0] : r.resident
        const fuCount = Array.isArray(r.followups) ? r.followups.length : 0
        return [
          r.incident_ref,
          res?.name_zh || res?.name || '—',
          hkidRef(res?.hkid_hash),
          TYPE_ZH[r.type] || r.type,
          SEV_ZH[r.severity] || r.severity,
          fmtDateTime(r.occurred_at),
          fmtDateTime(r.closed_at),
          fuCount,
          STATUS_ZH[r.status] || r.status,
        ]
      })
    }

    // Build worksheet
    const wsData: unknown[][] = [
      [title],
      [period],
      [generated],
      [swdNote],
      [],
      HEADERS[report_type],
      ...rows,
    ]

    const ws = xlsx.utils.aoa_to_sheet(wsData)

    // Column widths
    ws['!cols'] = HEADERS[report_type].map(() => ({ wch: 20 }))

    // Merge title row
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS[report_type].length - 1 } },
    ]

    xlsx.utils.book_append_sheet(wb, ws, title.slice(0, 31))

    // Generate buffer
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `${title}_${from_date}_${to_date}.xlsx`

    return new Response(buf, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(buf.byteLength),
      },
    })

  } catch (err) {
    console.error('[report-generate] Error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
