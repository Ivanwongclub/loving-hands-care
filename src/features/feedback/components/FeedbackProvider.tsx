// Top-level provider for the feedback layer.
//
// Mounts the mode context, the toggle button, and the overlay.
//
// Excluded from family portal routes and the kiosk:
//   - /family/* (external families, not internal staff)
//   - /attendance/kiosk (PIN-auth tablet, no staff session for feedback)
//
// Also gated by role: only roles in FEEDBACK_VISIBLE_TO_ROLES see the overlay.

import { useEffect, useState, type ReactNode } from "react";
import { FeedbackModeProvider } from "../hooks/useFeedbackMode";
import { FeedbackToggleButton } from "./FeedbackToggleButton";
import { FeedbackOverlay } from "./FeedbackOverlay";
import { FEEDBACK_VISIBLE_TO_ROLES } from "../config";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";

const EXCLUDED_PREFIXES = ["/family", "/attendance/kiosk"];

function isCurrentRouteExcluded(): boolean {
  if (typeof window === "undefined") return true;
  const path = window.location.pathname;
  return EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [excluded, setExcluded] = useState(() => isCurrentRouteExcluded());
  const { staff } = useCurrentStaff();

  useEffect(() => {
    const check = () => setExcluded(isCurrentRouteExcluded());
    window.addEventListener("popstate", check);
    const interval = window.setInterval(check, 500);
    return () => {
      window.removeEventListener("popstate", check);
      window.clearInterval(interval);
    };
  }, []);

  const roleAllowed = staff?.role
    ? FEEDBACK_VISIBLE_TO_ROLES.includes(staff.role as never)
    : false;

  // Hide overlay/toggle when route is excluded or role isn't permitted —
  // children always render so the underlying app is never blocked.
  if (excluded || !roleAllowed) return <>{children}</>;

  return (
    <FeedbackModeProvider>
      {children}
      <FeedbackToggleButton />
      <FeedbackOverlay />
    </FeedbackModeProvider>
  );
}
