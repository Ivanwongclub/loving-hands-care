// Domain entity type aliases (skeleton — populated as DB tables are added).
//
// `Tables<'table_name'>` from the auto-generated Supabase types is the single
// source of truth for row shapes. As tables are added in S2+, re-export
// convenient aliases here so feature code never imports from the generated
// types directly.

import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";

// Example skeleton aliases — uncomment and adjust as tables are added:
// export type Resident = Tables<"residents">;
// export type ResidentInsert = TablesInsert<"residents">;
// export type ResidentUpdate = TablesUpdate<"residents">;
// export type AppRole = Enums<"app_role">;

// Re-export helpers so callers can `import type { Tables } from "@/types/database"`.
export type { Tables, TablesInsert, TablesUpdate, Enums };

// Domain status string unions (kept here so they stay in lock-step with i18n keys
// in src/i18n/locales/*.json under alertStatus, taskStatus, emarStatus, etc.).
export type AlertStatus = "open" | "acknowledged" | "assigned" | "resolved" | "escalated";
export type TaskStatus = "pending" | "inProgress" | "completed" | "overdue" | "cancelled";
export type EmarStatus = "due" | "administered" | "refused" | "held" | "late" | "missed";
export type IcpStatus = "draft" | "pendingApproval" | "active" | "superseded" | "rejected";
export type BedStatus = "available" | "occupied" | "reserved" | "outOfService";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
