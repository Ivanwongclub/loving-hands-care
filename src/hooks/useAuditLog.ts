import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";

export interface AuditLogParams {
  action: string;
  entity_type: string;
  entity_id: string;
  branch_id?: string | null;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Write-only audit log helper.
 *
 * Returns { logAction } — call after every mutation.
 * Audit failures are swallowed (console.error) so they never block UX.
 */
export function useAuditLog() {
  const { staff } = useCurrentStaff();

  const logAction = useCallback(
    async (params: AuditLogParams): Promise<void> => {
      try {
        const { error } = await supabase.from("audit_logs").insert({
          action: params.action,
          entity_type: params.entity_type,
          entity_id: params.entity_id,
          branch_id: params.branch_id ?? null,
          actor_id: staff?.id ?? null,
          actor_role: staff?.role ?? null,
          before_state: (params.before_state ?? null) as never,
          after_state: (params.after_state ?? null) as never,
          metadata: (params.metadata ?? null) as never,
        });
        if (error) {
          // eslint-disable-next-line no-console
          console.error("[audit_log] insert failed:", error.message);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[audit_log] unexpected error:", err);
      }
    },
    [staff?.id, staff?.role],
  );

  return { logAction };
}
