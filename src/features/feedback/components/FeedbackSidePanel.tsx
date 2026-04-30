// Right-side panel listing pins on current route.
// Opens when feedback mode is on OR a pin is active.
// F4: list only. F6 adds full thread view + triage actions.

import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useFeedbackMode } from "../hooks/useFeedbackMode";
import { useFeedbackPins } from "../hooks/useFeedbackPins";
import type { FeedbackPinRow, PinStatus } from "../types";

const STATUS_LABEL_KEY: Record<PinStatus, string> = {
  new: "feedback.status.new",
  triaged: "feedback.status.triaged",
  in_progress: "feedback.status.inProgress",
  resolved: "feedback.status.resolved",
  closed: "feedback.status.closed",
};

const STATUS_COLOR: Record<PinStatus, string> = {
  new: "#E24B4A",
  triaged: "#7c3aed",
  in_progress: "#EF9F27",
  resolved: "#1D9E75",
  closed: "#6b7280",
};

export function FeedbackSidePanel() {
  const { t } = useTranslation();
  const { isOn, activePinId, setActivePin, setOn } = useFeedbackMode();
  const { data: pins = [] } = useFeedbackPins();

  const isOpen = isOn || activePinId !== null;
  if (!isOpen) return null;

  const handleClose = () => {
    setActivePin(null);
    setOn(false);
  };

  return (
    <aside
      data-feedback-ui="true"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        backgroundColor: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-modal)",
        zIndex: 9995,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: 16,
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            {t("feedback.sidePanel.title")}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
            {t("feedback.sidePanel.openCount", { count: pins.length })}
          </div>
        </div>
        <button
          data-feedback-ui="true"
          type="button"
          onClick={handleClose}
          aria-label={t("feedback.sidePanel.close")}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            padding: 4,
            display: "grid",
            placeItems: "center",
          }}
        >
          <X size={18} />
        </button>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {pins.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            {t("feedback.sidePanel.empty")}
          </div>
        ) : (
          pins.map((pin: FeedbackPinRow) => {
            const color = STATUS_COLOR[pin.status as PinStatus] ?? STATUS_COLOR.new;
            const isActive = pin.id === activePinId;
            return (
              <button
                key={pin.id}
                data-feedback-ui="true"
                type="button"
                onClick={() => setActivePin(isActive ? null : pin.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: 10,
                  marginBottom: 6,
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${isActive ? color : "var(--border-subtle)"}`,
                  backgroundColor: isActive ? "var(--bg-hover-subtle)" : "var(--bg-surface)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      backgroundColor: color,
                      color: "var(--text-inverse)",
                      fontSize: 10,
                      fontWeight: 600,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {pin.pin_number}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      borderRadius: "var(--radius-xs)",
                      backgroundColor: `${color}20`,
                      color,
                      fontWeight: 500,
                    }}
                  >
                    {t(STATUS_LABEL_KEY[pin.status as PinStatus])}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-primary)",
                    marginBottom: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {pin.comment_text}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {pin.author_name} · {pin.author_role}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
