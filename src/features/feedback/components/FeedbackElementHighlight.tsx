// Visual outline rendered over the hovered element while picker is active.
// Updates position on scroll/resize via requestAnimationFrame.

import { useEffect, useState } from "react";

export function FeedbackElementHighlight({ element }: { element: HTMLElement }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      setRect(element.getBoundingClientRect());
      raf = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, [element]);

  if (!rect) return null;

  return (
    <div
      data-feedback-ui="true"
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        pointerEvents: "none",
        zIndex: 9997,
        outline: "2px solid var(--color-primary, #4f46e5)",
        outlineOffset: "2px",
        backgroundColor: "rgba(79, 70, 229, 0.08)",
        borderRadius: "var(--radius-sm, 4px)",
        transition: "all 60ms linear",
      }}
    />
  );
}
