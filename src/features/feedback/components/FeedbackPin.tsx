// Numbered marker rendered over a pinned element. Click toggles thread in side panel.

import { useFeedbackMode } from "../hooks/useFeedbackMode";
import type { FeedbackPinRow, PinStatus } from "../types";

const STATUS_COLOR: Record<PinStatus, string> = {
  new: "#E24B4A",
  triaged: "#7c3aed",
  in_progress: "#EF9F27",
  resolved: "#1D9E75",
  closed: "#6b7280",
};

type Props = {
  pin: FeedbackPinRow;
};

export function FeedbackPin({ pin }: Props) {
  const { activePinId, setActivePin } = useFeedbackMode();
  const isActive = activePinId === pin.id;
  const baseColor = STATUS_COLOR[pin.status as PinStatus] ?? STATUS_COLOR.new;

  const ageMs = Date.now() - new Date(pin.created_at).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const isFaded = pin.status === "resolved" && ageMs > sevenDays;

  return (
    <button
      data-feedback-ui="true"
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setActivePin(isActive ? null : pin.id);
      }}
      title={pin.comment_text.slice(0, 80)}
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        backgroundColor: baseColor,
        color: "var(--text-inverse)",
        border: "2px solid var(--bg-surface)",
        boxShadow: isActive
          ? `0 0 0 3px ${baseColor}40, 0 2px 6px rgba(0,0,0,0.2)`
          : "0 2px 6px rgba(0,0,0,0.2)",
        cursor: "pointer",
        opacity: isFaded ? 0.3 : 1,
        fontSize: 11,
        fontWeight: 600,
        display: "grid",
        placeItems: "center",
        transition: "box-shadow var(--duration-fast) ease, opacity var(--duration-fast) ease",
        padding: 0,
      }}
    >
      {pin.pin_number}
    </button>
  );
}
