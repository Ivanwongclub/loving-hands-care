// Type definitions for the feedback layer.
// Mirror the DB schema. These are not auto-generated — they're application-level
// types used by hooks, components, and library functions.

import type { Database } from "@/integrations/supabase/types";

// Pull table row types from generated types
export type FeedbackPinRow = Database["public"]["Tables"]["feedback_pins"]["Row"];
export type FeedbackCommentRow = Database["public"]["Tables"]["feedback_comments"]["Row"];
export type FeedbackReactionRow = Database["public"]["Tables"]["feedback_reactions"]["Row"];

export type FeedbackPinInsert = Database["public"]["Tables"]["feedback_pins"]["Insert"];
export type FeedbackCommentInsert = Database["public"]["Tables"]["feedback_comments"]["Insert"];
export type FeedbackReactionInsert = Database["public"]["Tables"]["feedback_reactions"]["Insert"];

// Status state machine
export type PinStatus = "new" | "triaged" | "in_progress" | "resolved" | "closed";

// Comment type tag
export type CommentType = "reply" | "status_update" | "resolution_note";

// HMS roles (matches staff_role enum in DB)
export type HmsStaffRole = "SYSTEM_ADMIN" | "BRANCH_ADMIN" | "SENIOR_NURSE" | "NURSE" | "CAREGIVER";

// Result returned from elementTargeting.captureTarget
export type TargetingResult = {
  feedback_id: string | null;
  selector_fallback: string | null;
  x_percent: number;     // 0-100, document-relative
  y_percent: number;     // 0-100, document-relative
  viewport_width: number;
  element_html: string;  // text-stripped, ≤2KB
};

// Position computation result for rendering pins
export type PinPosition = {
  top: number;     // px, document coords
  left: number;    // px, document coords
  visible: boolean; // whether the target is currently in the DOM
};

// Input shape for createPin mutation (built from TargetingResult + comment text + author info)
export type CreatePinInput = {
  page_route: string;
  page_title: string;
  comment_text: string;
  feedback_id: string | null;
  selector_fallback: string | null;
  x_percent: number;
  y_percent: number;
  viewport_width: number;
  element_html: string;
};
