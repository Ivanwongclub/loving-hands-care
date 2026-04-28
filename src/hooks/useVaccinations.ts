import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type VaccinationRecordRow = Tables<"vaccination_records"> & {
  administrator: { id: string; name: string; name_zh: string | null } | null;
};

export const VACCINE_TYPES = [
  "INFLUENZA",
  "PNEUMOCOCCAL_PCV13",
  "PNEUMOCOCCAL_PPSV23",
  "COVID19_BIVALENT",
  "COVID19_OMICRON",
  "SHINGLES_RECOMBINANT",
  "OTHER",
] as const;
export type VaccineType = (typeof VACCINE_TYPES)[number];

export const INJECTION_SITES = ["LEFT_DELTOID", "RIGHT_DELTOID", "OTHER"] as const;
export type InjectionSite = (typeof INJECTION_SITES)[number];

export function useVaccinations(residentId: string | null) {
  const query = useQuery({
    queryKey: ["vaccinations", residentId],
    enabled: !!residentId,
    queryFn: async (): Promise<VaccinationRecordRow[]> => {
      const { data, error } = await supabase
        .from("vaccination_records")
        .select("*, administrator:administered_by_staff_id(id, name, name_zh)")
        .eq("resident_id", residentId!)
        .order("administered_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VaccinationRecordRow[];
    },
  });

  return {
    records: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export interface SuggestedVaccine {
  type: VaccineType;
  reasonKey: "suggestNeverGiven" | "suggestOverdue";
  monthsAgo?: number;
}

/** Pure client-side calculation. */
export function calculateSuggestions(records: VaccinationRecordRow[]): SuggestedVaccine[] {
  const latestByType = new Map<string, VaccinationRecordRow>();
  for (const r of records) {
    const existing = latestByType.get(r.vaccine_type);
    if (!existing || new Date(r.administered_date).getTime() > new Date(existing.administered_date).getTime()) {
      latestByType.set(r.vaccine_type, r);
    }
  }
  const now = Date.now();
  const monthsSince = (dateISO: string) =>
    Math.floor((now - new Date(dateISO).getTime()) / (1000 * 60 * 60 * 24 * 30));

  const suggestions: SuggestedVaccine[] = [];

  // INFLUENZA — yearly
  const flu = latestByType.get("INFLUENZA");
  if (!flu) {
    suggestions.push({ type: "INFLUENZA", reasonKey: "suggestNeverGiven" });
  } else {
    const m = monthsSince(flu.administered_date);
    if (monthsSince(flu.administered_date) >= 12) {
      suggestions.push({ type: "INFLUENZA", reasonKey: "suggestOverdue", monthsAgo: m });
    }
  }

  // COVID — yearly (any of bivalent or omicron)
  for (const type of ["COVID19_BIVALENT", "COVID19_OMICRON"] as const) {
    const rec = latestByType.get(type);
    if (rec && monthsSince(rec.administered_date) >= 12) {
      suggestions.push({ type, reasonKey: "suggestOverdue", monthsAgo: monthsSince(rec.administered_date) });
    }
  }

  // Pneumococcal — if neither given
  if (!latestByType.has("PNEUMOCOCCAL_PCV13") && !latestByType.has("PNEUMOCOCCAL_PPSV23")) {
    suggestions.push({ type: "PNEUMOCOCCAL_PCV13", reasonKey: "suggestNeverGiven" });
    suggestions.push({ type: "PNEUMOCOCCAL_PPSV23", reasonKey: "suggestNeverGiven" });
  }

  // Shingles — if never given
  if (!latestByType.has("SHINGLES_RECOMBINANT")) {
    suggestions.push({ type: "SHINGLES_RECOMBINANT", reasonKey: "suggestNeverGiven" });
  }

  return suggestions;
}
