// Element picker: captures the next click on any non-feedback-UI element.
//
// Mechanics:
//   - When enabled, listens to document click events with capture: true so we
//     intercept BEFORE the underlying app's handlers fire
//   - On click outside feedback-ui elements: capture target, prevent propagation
//   - Tracks hovered element separately for visual highlight
//
// Critical: All event listeners must be capture: true to intercept correctly.

import { useCallback, useEffect, useRef, useState } from "react";
import { isFeedbackUiElement } from "../lib/elementTargeting";

type CapturedClick = {
  element: HTMLElement;
  x: number; // document-relative
  y: number; // document-relative
};

export function useElementPicker(enabled: boolean) {
  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);
  const [capturedClick, setCapturedClick] = useState<CapturedClick | null>(null);

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) {
      setHoveredEl(null);
      return;
    }

    const onMouseOver = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target || !(target instanceof HTMLElement)) return;
      if (isFeedbackUiElement(target)) {
        setHoveredEl(null);
        return;
      }
      setHoveredEl(target);
    };

    const onMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (!related || !(related instanceof HTMLElement) || isFeedbackUiElement(related)) {
        setHoveredEl(null);
      }
    };

    const onClick = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target || !(target instanceof HTMLElement)) return;
      if (isFeedbackUiElement(target)) return; // let feedback-ui clicks through

      e.preventDefault();
      e.stopPropagation();

      setCapturedClick({
        element: target,
        x: e.clientX + window.scrollX,
        y: e.clientY + window.scrollY,
      });
    };

    document.addEventListener("mouseover", onMouseOver, { capture: true });
    document.addEventListener("mouseout", onMouseOut, { capture: true });
    document.addEventListener("click", onClick, { capture: true });

    document.body.style.cursor = "crosshair";

    return () => {
      document.removeEventListener("mouseover", onMouseOver, { capture: true });
      document.removeEventListener("mouseout", onMouseOut, { capture: true });
      document.removeEventListener("click", onClick, { capture: true });
      document.body.style.cursor = "";
    };
  }, [enabled]);

  const reset = useCallback(() => {
    setCapturedClick(null);
    setHoveredEl(null);
  }, []);

  return { hoveredEl, capturedClick, reset };
}
