import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { Tables, TablesUpdate, Enums } from "@/integrations/supabase/types";

export type StaffRow = Tables<"staff">;
export type StaffRoleEnum = Enums<"staff_role">;
export type StaffStatusEnum = Enums<"staff_status">;

interface UseStaffParams {
  branchId?: string | null;
  status?: StaffStatusEnum | "ALL";
  role?: StaffRoleEnum | "ALL";
}

/**
 * Fetches staff records.
 * - SYSTEM_ADMIN: all active (non-deleted) staff
 * - Other roles: staff whose branch_ids overlap branchId
 *
 * Soft-delete only: deleted_at IS NULL.
 */
export function useStaff({ branchId, status = "ALL", role = "ALL" }: UseStaffParams = {}) {
  const { staff: currentStaff, isLoading: currentLoading } = useCurrentStaff();

  const query = useQuery({
    queryKey: ["staff", currentStaff?.id ?? null, branchId ?? null, status, role],
    enabled: !!currentStaff,
    queryFn: async (): Promise<StaffRow[]> => {
      if (!currentStaff) return [];
      let q = supabase.from("staff").select("*").is("deleted_at", null);

      if (currentStaff.role !== "SYSTEM_ADMIN" && branchId) {
        q = q.contains("branch_ids", [branchId]);
      }
      if (status !== "ALL") {
        q = q.eq("status", status);
      }
      if (role !== "ALL") {
        q = q.eq("role", role);
      }

      q = q.order("name_zh", { ascending: true });

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as StaffRow[];
    },
  });

  return {
    staff: query.data ?? [],
    isLoading: currentLoading || query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

// ---------- Mutations ----------

export interface InviteStaffInput {
  name: string;
  name_zh: string | null;
  email: string;
  role: StaffRoleEnum;
  branch_ids: string[];
  temp_password: string;
  is_shared_device: boolean;
}

export function useInviteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteStaffInput): Promise<StaffRow> => {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: input,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.staff as StaffRow;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

export interface UpdateStaffInput {
  staffId: string;
  patch: Pick<TablesUpdate<"staff">, "name" | "name_zh" | "phone" | "role" | "branch_ids" | "is_shared_device">;
  before?: StaffRow | null;
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  return useMutation({
    mutationFn: async ({ staffId, patch }: UpdateStaffInput): Promise<StaffRow> => {
      const { data, error } = await supabase
        .from("staff")
        .update(patch)
        .eq("id", staffId)
        .select("*")
        .single();
      if (error) throw error;
      return data as StaffRow;
    },
    onSuccess: async (updated, vars) => {
      await logAction({
        action: "STAFF_UPDATED",
        entity_type: "staff",
        entity_id: updated.id,
        branch_id: updated.branch_ids?.[0] ?? null,
        before_state: (vars.before ?? null) as unknown as Record<string, unknown> | null,
        after_state: updated as unknown as Record<string, unknown>,
      });
      await qc.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

export interface DeactivateStaffInput {
  staffId: string;
  metadata?: Record<string, unknown>;
}

export function useDeactivateStaff() {
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  return useMutation({
    mutationFn: async ({ staffId }: DeactivateStaffInput): Promise<StaffRow> => {
      const { data, error } = await supabase
        .from("staff")
        .update({ status: "INACTIVE" as StaffStatusEnum })
        .eq("id", staffId)
        .select("*")
        .single();
      if (error) throw error;
      return data as StaffRow;
    },
    onSuccess: async (updated, vars) => {
      await logAction({
        action: "STAFF_DEACTIVATED",
        entity_type: "staff",
        entity_id: updated.id,
        branch_id: updated.branch_ids?.[0] ?? null,
        after_state: { status: "INACTIVE" } as unknown as Record<string, unknown>,
        metadata: vars.metadata ?? null,
      });
      await qc.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

export interface AdminPinActionInput {
  staff_id: string;
  action: "unlock" | "reset";
}

export function useAdminPinAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ staff_id, action }: AdminPinActionInput) => {
      const fn = action === "unlock" ? "admin-unlock-pin" : "admin-reset-pin";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { staff_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(vars.action === "unlock" ? "PIN unlocked" : "PIN reset");
    },
  });
}
