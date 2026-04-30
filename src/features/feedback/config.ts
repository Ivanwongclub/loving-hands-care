import type { HmsStaffRole } from "./types";

// PRIMARY GATE (build-time): controls whether the feedback module is bundled.
// Set to false before production deploy — entire module is dead-code-eliminated.
export const FEEDBACK_ENABLED = true;

// SECONDARY GATE (runtime): which staff roles see the toggle button when
// FEEDBACK_ENABLED is true. Useful during UAT to pilot with select roles
// before opening to all staff. To restrict, edit the array.
export const FEEDBACK_VISIBLE_TO_ROLES: HmsStaffRole[] = [
  "SYSTEM_ADMIN",
  "BRANCH_ADMIN",
  "SENIOR_NURSE",
  "NURSE",
  "CAREGIVER",
];
