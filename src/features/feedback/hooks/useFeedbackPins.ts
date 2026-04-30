// Read pins for the current route. 60s polling (HMS standard, no realtime).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentRoute } from "../lib/routeMatching";
import type { FeedbackPinRow } from "../types";

const POLL_INTERVAL_MS = 60_000;

export function useFeedbackPins(routeOverride?: string) {
  const route = routeOverride ?? getCurrentRoute();

  return useQuery({
    queryKey: ["feedbackPins", route],
    queryFn: async (): Promise<FeedbackPinRow[]> => {
      const { data, error } = await supabase
        .from("feedback_pins")
        .select("*")
        .eq("page_route", route)
        .neq("status", "closed")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

// For F8 kanban board (added now to avoid touching this file later)
export function useAllFeedbackPins() {
  return useQuery({
    queryKey: ["feedbackPins", "all"],
    queryFn: async (): Promise<FeedbackPinRow[]> => {
      const { data, error } = await supabase
        .from("feedback_pins")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 30_000,
  });
}
