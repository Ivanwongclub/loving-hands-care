import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Enums } from "@/integrations/supabase/types";

export type DCUEnrollmentStatus = Enums<"enrollment_status">;

export interface ResidentLite {
  id: string;
  name: string;
  name_zh: string;
  photo_storage_path: string | null;
}

export type DCUEnrollment = Tables<"dcu_enrollments"> & {
  residents: ResidentLite | null;
};

interface UseDCUEnrollmentsParams {
  branchId: string | null;
  status?: DCUEnrollmentStatus | "ALL";
}

/**
 * Fetches DCU enrollments for a branch with optional resident join.
 */
export function useDCUEnrollments({ branchId, status = "ALL" }: UseDCUEnrollmentsParams) {
  const query = useQuery({
    queryKey: ["dcuEnrollments", branchId, status],
    enabled: !!branchId,
    queryFn: async (): Promise<DCUEnrollment[]> => {
      if (!branchId) return [];
      let q = supabase
        .from("dcu_enrollments")
        .select("*, residents:resident_id(id, name, name_zh, photo_storage_path)")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false });

      if (status !== "ALL") q = q.eq("status", status);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DCUEnrollment[];
    },
  });

  return {
    enrollments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
