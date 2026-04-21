import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import type { Tables } from "@/integrations/supabase/types";

export type Branch = Tables<"branches">;

/**
 * Fetches all active branches the current user can access.
 * - SYSTEM_ADMIN: all active branches
 * - Otherwise: branches whose id ∈ staff.branch_ids
 */
export function useBranches() {
  const { staff, isLoading: staffLoading } = useCurrentStaff();

  const query = useQuery({
    queryKey: ["branches", staff?.id ?? null],
    enabled: !!staff,
    queryFn: async (): Promise<Branch[]> => {
      if (!staff) return [];
      let q = supabase.from("branches").select("*").eq("is_active", true);
      if (staff.role !== "SYSTEM_ADMIN") {
        if (!staff.branch_ids || staff.branch_ids.length === 0) return [];
        q = q.in("id", staff.branch_ids);
      }
      q = q.order("name_zh", { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });

  return {
    branches: query.data ?? [],
    isLoading: staffLoading || query.isLoading,
    error: query.error as Error | null,
  };
}
