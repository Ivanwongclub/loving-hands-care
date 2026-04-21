import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

export type StaffRecord = Tables<"staff">;

/**
 * Fetches the staff record for the currently authenticated auth user.
 * Uses the `auth_staff()` SECURITY DEFINER RPC to bypass any RLS recursion.
 */
export function useCurrentStaff() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["currentStaff", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<StaffRecord | null> => {
      const { data, error } = await supabase.rpc("auth_staff");
      if (error) throw error;
      // RPC returns a single staff row (SETOF with LIMIT 1) — supabase-js returns array
      if (Array.isArray(data)) return (data[0] as StaffRecord | undefined) ?? null;
      return (data as StaffRecord | null) ?? null;
    },
  });

  return {
    staff: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
