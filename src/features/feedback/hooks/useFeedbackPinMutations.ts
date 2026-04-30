// Mutations for creating pins. Author fields snapshotted at pin time.
//
// FLAG: pin_number is required in the DB Insert type (not auto-generated).
// The mutation fetches the current max pin_number for the route and increments.
// Race condition possible with concurrent inserts but acceptable for internal tooling.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useAuth } from "@/lib/AuthContext";
import type { CreatePinInput, FeedbackPinRow } from "../types";

export function useFeedbackPinMutations() {
  const qc = useQueryClient();
  const { staff } = useCurrentStaff();
  const { user } = useAuth();

  const createPin = useMutation({
    mutationFn: async (input: CreatePinInput): Promise<FeedbackPinRow> => {
      if (!user || !staff) {
        throw new Error("Not authenticated or no staff record");
      }

      // Compute next pin_number: max existing for this route + 1
      const { data: existing } = await supabase
        .from("feedback_pins")
        .select("pin_number")
        .eq("page_route", input.page_route)
        .order("pin_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPinNumber = ((existing?.pin_number as number | null) ?? 0) + 1;

      const { data, error } = await supabase
        .from("feedback_pins")
        .insert({
          page_route: input.page_route,
          page_title: input.page_title,
          feedback_id: input.feedback_id,
          selector_fallback: input.selector_fallback,
          x_percent: input.x_percent,
          y_percent: input.y_percent,
          viewport_width: input.viewport_width,
          element_html: input.element_html,
          comment_text: input.comment_text,
          pin_number: nextPinNumber,
          author_id: user.id,
          author_name: staff.name_zh ?? staff.name ?? "Unknown",
          author_role: staff.role,
          author_branch_id: staff.branch_ids?.[0] ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as FeedbackPinRow;
    },
    onSuccess: (newPin) => {
      void qc.invalidateQueries({ queryKey: ["feedbackPins", newPin.page_route] });
      void qc.invalidateQueries({ queryKey: ["feedbackPins", "all"] });
    },
  });

  return { createPin };
}
