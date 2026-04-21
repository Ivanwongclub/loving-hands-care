import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type WoundEntryRow = Tables<"wound_entries">;
export type WoundRow = Tables<"wounds"> & {
  wound_entries: WoundEntryRow[];
};

export function useWounds(residentId: string | null) {
  const query = useQuery({
    queryKey: ["wounds", residentId],
    enabled: !!residentId,
    queryFn: async (): Promise<WoundRow[]> => {
      if (!residentId) return [];
      const { data, error } = await supabase
        .from("wounds")
        .select("*, wound_entries(*)")
        .eq("resident_id", residentId)
        .order("first_noted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WoundRow[];
    },
  });

  const wounds = query.data ?? [];
  const activeWounds = wounds.filter((w) => w.status !== "HEALED");
  const healedWounds = wounds.filter((w) => w.status === "HEALED");

  return {
    wounds,
    activeWounds,
    healedWounds,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
