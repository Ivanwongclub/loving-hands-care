// Hosts the element picker and visual highlight when feedback mode is on.
// F4: captured click opens FeedbackCommentBox inline at click point.

import { useEffect, useState } from "react";
import { useFeedbackMode } from "../hooks/useFeedbackMode";
import { useElementPicker } from "../hooks/useElementPicker";
import { FeedbackElementHighlight } from "./FeedbackElementHighlight";
import { FeedbackCommentBox } from "./FeedbackCommentBox";
import { captureTarget } from "../lib/elementTargeting";
import type { TargetingResult } from "../types";

type PendingCapture = {
  target: TargetingResult;
  position: { x: number; y: number };
};

export function FeedbackOverlay() {
  const { isOn, setOn } = useFeedbackMode();
  const { hoveredEl, capturedClick, reset } = useElementPicker(isOn);
  const [pending, setPending] = useState<PendingCapture | null>(null);

  // ESC exits feedback mode and clears any open comment box
  useEffect(() => {
    if (!isOn && !pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPending(null);
        setOn(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOn, pending, setOn]);

  // When user clicks an element, capture targeting data and open comment box
  useEffect(() => {
    if (!capturedClick) return;
    // eslint-disable-next-line no-console
    console.log("[F4 DIAG] capturedClick triggered:", capturedClick);
    const target = captureTarget(capturedClick.element, {
      x: capturedClick.x,
      y: capturedClick.y,
    });
    setPending({
      target,
      position: { x: capturedClick.x, y: capturedClick.y },
    });
    // eslint-disable-next-line no-console
    console.log("[F4 DIAG] pending set, target:", target);
    reset();
  }, [capturedClick, reset]);

  // eslint-disable-next-line no-console
  console.log("[F4 DIAG] render — isOn:", isOn, "hoveredEl:", hoveredEl?.tagName, "pending:", pending);

  return (
    <div data-feedback-ui="true">
      {isOn && hoveredEl && !pending && (
        <FeedbackElementHighlight element={hoveredEl} />
      )}
      {pending && (
        <FeedbackCommentBox
          target={pending.target}
          position={pending.position}
          onClose={() => {
            setPending(null);
            setOn(false);
          }}
        />
      )}
    </div>
  );
}
