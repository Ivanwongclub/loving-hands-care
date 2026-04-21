import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ThresholdsRow = Tables<"vitals_thresholds">;

export interface ThresholdRange {
  min?: number;
  max?: number;
}

export interface ThresholdMap {
  bp_systolic?: ThresholdRange;
  bp_diastolic?: ThresholdRange;
  pulse?: ThresholdRange;
  spo2?: ThresholdRange;
  temp_c?: ThresholdRange;
  weight_kg?: ThresholdRange;
  glucose_mmol?: ThresholdRange;
}

export function useVitalsThresholds(residentId: string | null) {
  const query = useQuery({
    queryKey: ["vitalsThresholds", residentId],
    enabled: !!residentId,
    queryFn: async (): Promise<ThresholdsRow | null> => {
      if (!residentId) return null;
      const { data, error } = await supabase
        .from("vitals_thresholds")
        .select("*")
        .eq("resident_id", residentId)
        .maybeSingle();
      if (error) throw error;
      return (data as ThresholdsRow | null) ?? null;
    },
  });

  return {
    thresholds: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
