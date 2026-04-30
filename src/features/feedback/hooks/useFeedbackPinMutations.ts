// Mutations for creating pins. Author fields snapshotted at pin time.
//
// pin_number is assigned by the feedback_pins_assign_number BEFORE INSERT trigger
// (MAX+1 per page_route, atomic). We pass pin_number: 0 as a placeholder to
// satisfy the generated types.ts schema — the trigger overwrites it before the
// row is committed.

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
          pin_number: 0, // placeholder — overwritten by feedback_pins_assign_number trigger
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
