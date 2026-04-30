// Floating toggle button, fixed bottom-right.
//
// Always visible to authenticated staff. Click toggles feedback mode on/off.
// When mode is OFF: subtle, semi-transparent.
// When mode is ON: prominent, full opacity, primary color.
//
// Critical: data-feedback-ui="true" attribute so the picker excludes itself.

import { MessageSquarePlus, X } from "lucide-react";
import { useFeedbackMode } from "../hooks/useFeedbackMode";

export function FeedbackToggleButton() {
  const { isOn, toggle } = useFeedbackMode();

  return (
    <button
      type="button"
      data-feedback-ui="true"
      aria-label={isOn ? "Exit feedback mode" : "Enter feedback mode"}
      onClick={toggle}
      onMouseEnter={(e) => {
        if (!isOn) e.currentTarget.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        if (!isOn) e.currentTarget.style.opacity = "0.7";
      }}
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: 9998,
        width: 48,
        height: 48,
        borderRadius: "var(--radius-full, 9999px)",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        border: "none",
        backgroundColor: isOn ? "var(--color-primary, #4f46e5)" : "var(--bg-surface, #1f2937)",
        color: isOn ? "var(--text-on-primary, #fff)" : "var(--text-secondary, #cbd5e1)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        opacity: isOn ? 1 : 0.7,
        transition: "opacity 120ms ease, background-color 120ms ease",
      }}
    >
      {isOn ? <X size={20} /> : <MessageSquarePlus size={20} />}
    </button>
  );
}
