import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import type { Tables, Enums } from "@/integrations/supabase/types";

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
