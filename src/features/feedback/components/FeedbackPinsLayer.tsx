// Renders all pins for the current route as a portal at document.body.
// Recomputes positions on rAF for scroll/resize. Stops rAF when no pins.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFeedbackPins } from "../hooks/useFeedbackPins";
import { computePinPosition } from "../lib/pinPositioning";
import { FeedbackPin } from "./FeedbackPin";
import type { FeedbackPinRow, PinPosition } from "../types";

export function FeedbackPinsLayer() {
  const { data: pins = [] } = useFeedbackPins();
  const [positions, setPositions] = useState<Record<string, PinPosition>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pins.length) {
      setPositions({});
      return;
    }
    let raf = 0;
    const update = () => {
      const next: Record<string, PinPosition> = {};
      for (const pin of pins) {
        next[pin.id] = computePinPosition(pin);
      }
      setPositions(next);
      raf = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, [pins]);

  if (!mounted) return null;

  return createPortal(
    <div
      data-feedback-ui="true"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 9990 }}
    >
      {pins.map((pin: FeedbackPinRow) => {
        const pos = positions[pin.id];
        if (!pos?.visible) return null;
        return (
          <div
            key={pin.id}
            data-feedback-ui="true"
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              pointerEvents: "auto",
            }}
          >
            <FeedbackPin pin={pin} />
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
