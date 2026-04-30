// Hosts the element picker and visual highlight when feedback mode is on.
// In F3: clicks log captured target to console (no DB write yet).
// F4 will replace the console.log with comment box + DB save.

import { useEffect } from "react";
import { useFeedbackMode } from "../hooks/useFeedbackMode";
import { useElementPicker } from "../hooks/useElementPicker";
import { FeedbackElementHighlight } from "./FeedbackElementHighlight";
import { captureTarget } from "../lib/elementTargeting";
import { getCurrentRoute, getCurrentPageTitle } from "../lib/routeMatching";

export function FeedbackOverlay() {
  const { isOn, setOn } = useFeedbackMode();
  const { hoveredEl, capturedClick, reset } = useElementPicker(isOn);

  // ESC exits feedback mode
  useEffect(() => {
    if (!isOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOn(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOn, setOn]);

  // F3: handle captured click by logging to console (F4 will open comment box)
  useEffect(() => {
    if (!capturedClick) return;
    const result = captureTarget(capturedClick.element, {
      x: capturedClick.x,
      y: capturedClick.y,
    });

    // eslint-disable-next-line no-console
    console.log("[feedback F3] captured target:", {
      route: getCurrentRoute(),
      title: getCurrentPageTitle(),
      ...result,
    });

    reset();
    setOn(false);
  }, [capturedClick, reset, setOn]);

  return (
    <div data-feedback-ui="true">
      {isOn && hoveredEl && <FeedbackElementHighlight element={hoveredEl} />}
    </div>
  );
}
