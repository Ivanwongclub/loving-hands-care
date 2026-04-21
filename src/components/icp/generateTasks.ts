import type { TablesInsert } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { ICPContent, TaskRule } from "./types";

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000; // HK is UTC+8 — used to keep dates local

function localTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildDueAt(dateStr: string, time: string): string {
  // Compose ISO for `dateStr` at HH:mm local — store as ISO string
  const [hh, mm] = (time || "08:00").split(":").map((n) => Number(n) || 0);
  const local = new Date(`${dateStr}T00:00:00.000Z`);
  local.setUTCHours(hh - 8, mm, 0, 0); // approximate HK→UTC; sufficient for scheduling
  return local.toISOString();
}

function expandRule(rule: TaskRule): { dueAt: string; title: string }[] {
  const today = localTodayISO();
  const out: { dueAt: string; title: string }[] = [];
  if (rule.frequency === "DAILY") {
    const t0 = rule.times[0] ?? "08:00";
    out.push({ dueAt: buildDueAt(today, t0), title: rule.title });
  } else if (rule.frequency === "TWICE_DAILY") {
    const t0 = rule.times[0] ?? "08:00";
    const t1 = rule.times[1] ?? "20:00";
    out.push({ dueAt: buildDueAt(today, t0), title: rule.title });
    out.push({ dueAt: buildDueAt(today, t1), title: rule.title });
  } else if (rule.frequency === "WEEKLY") {
    const future = new Date(`${today}T00:00:00.000Z`);
    future.setUTCDate(future.getUTCDate() + 7);
    out.push({ dueAt: buildDueAt(future.toISOString().slice(0, 10), "08:00"), title: rule.title });
  } else {
    out.push({ dueAt: buildDueAt(today, "08:00"), title: rule.title });
  }
  return out;
}

export async function generateTasksFromICP(
  icpId: string,
  content: ICPContent,
  residentId: string,
  branchId: string,
): Promise<number> {
  const rows: TablesInsert<"tasks">[] = [];
  for (const rule of content.task_rules) {
    for (const occ of expandRule(rule)) {
      rows.push({
        branch_id: branchId,
        resident_id: residentId,
        icp_id: icpId,
        type: rule.type,
        title: occ.title,
        due_at: occ.dueAt,
        status: "PENDING",
        assigned_to: null,
      });
    }
  }
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("tasks").insert(rows);
  if (error) throw error;
  return rows.length;
}
