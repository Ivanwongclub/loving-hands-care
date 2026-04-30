// Top-level provider for the feedback layer.
//
// Mounts the mode context, the toggle button, and the overlay.
//
// Excluded from family portal routes and the kiosk:
//   - /family/* (external families, not internal staff)
//   - /attendance/kiosk (PIN-auth tablet, no staff session for feedback)

import { useEffect, useState, type ReactNode } from "react";
import { FeedbackModeProvider } from "../hooks/useFeedbackMode";
import { FeedbackToggleButton } from "./FeedbackToggleButton";
import { FeedbackOverlay } from "./FeedbackOverlay";

const EXCLUDED_PREFIXES = ["/family", "/attendance/kiosk"];

function isCurrentRouteExcluded(): boolean {
  if (typeof window === "undefined") return true;
  const path = window.location.pathname;
  return EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [excluded, setExcluded] = useState(() => isCurrentRouteExcluded());

  useEffect(() => {
    const check = () => setExcluded(isCurrentRouteExcluded());
    window.addEventListener("popstate", check);
    const interval = window.setInterval(check, 500);
    return () => {
      window.removeEventListener("popstate", check);
      window.clearInterval(interval);
    };
  }, []);

  if (excluded) return <>{children}</>;

  return (
    <FeedbackModeProvider>
      {children}
      <FeedbackToggleButton />
      <FeedbackOverlay />
    </FeedbackModeProvider>
  );
}
