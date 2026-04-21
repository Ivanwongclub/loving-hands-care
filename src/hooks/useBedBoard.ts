import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Enums } from "@/integrations/supabase/types";

type Location = Tables<"locations">;
export type BedStatus = Enums<"location_status">;

export interface BedBoardEntry {
  id: string;
  code: string;
  name: string;
  name_zh: string | null;
  status: BedStatus;
  parent_id: string | null;
  resident_id: string | null;
  resident_name: string | null;
  admission_date: string | null;
}

interface ResidentLite {
  id: string;
  name: string;
  name_zh: string;
  bed_id: string | null;
  admission_date: string;
}

/**
 * Real-time bed occupancy. Subscribes to Supabase Realtime on `locations`
 * and `residents` for this branch and invalidates the query on changes.
 */
export function useBedBoard(branchId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["bedBoard", branchId] as const;

  const query = useQuery({
    queryKey,
    enabled: !!branchId,
    queryFn: async (): Promise<BedBoardEntry[]> => {
      if (!branchId) return [];

      const { data: beds, error: bedErr } = await supabase
        .from("locations")
        .select("*")
        .eq("branch_id", branchId)
        .eq("type", "BED")
        .order("code", { ascending: true });
      if (bedErr) throw bedErr;

      const { data: residents, error: resErr } = await supabase
        .from("residents")
        .select("id, name, name_zh, bed_id, admission_date")
        .eq("branch_id", branchId)
        .eq("status", "ADMITTED")
        .is("deleted_at", null);
      if (resErr) throw resErr;

      const residentByBed = new Map<string, ResidentLite>();
      for (const r of (residents ?? []) as ResidentLite[]) {
        if (r.bed_id) residentByBed.set(r.bed_id, r);
      }

      return ((beds ?? []) as Location[]).map((b) => {
        const res = residentByBed.get(b.id);
        return {
          id: b.id,
          code: b.code,
          name: b.name,
          name_zh: b.name_zh,
          status: b.status,
          parent_id: b.parent_id,
          resident_id: res?.id ?? null,
          resident_name: res ? res.name_zh || res.name : null,
          admission_date: res?.admission_date ?? null,
        };
      });
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!branchId) return;
    const channel = supabase
      .channel(`bedboard:${branchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "locations", filter: `branch_id=eq.${branchId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "residents", filter: `branch_id=eq.${branchId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, queryClient]);

  return {
    beds: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
