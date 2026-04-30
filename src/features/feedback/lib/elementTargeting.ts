// Element targeting library: hybrid approach.
//
// Priority order at capture time:
//   1. Walk up from the clicked element looking for [data-feedback-id] (max 5 levels)
//   2. If found: store feedback_id (most stable, survives layout changes)
//   3. Always: capture x_percent / y_percent of click point (document-relative)
//   4. Always: capture viewport_width (for fallback validation if document scales)
//   5. Always: capture element_html snapshot (text stripped, 2KB cap)
//
// CSS selector fallback was considered and rejected during design — shadcn class
// soup makes selectors fragile. We use feedback_id + x/y% as the two layers.
//
// Resolution at render time:
//   1. If feedback_id: querySelector([data-feedback-id="..."])
//   2. Else: position via x_percent / y_percent against current document size

import type { FeedbackPinRow, TargetingResult } from "../types";
import { captureElementSnapshot } from "./elementSnapshot";

const MAX_PARENT_WALK = 5;

/**
 * Capture a target from a click event.
 * @param el The element that was clicked
 * @param clickPoint Document-relative coordinates (clientX + scrollX, etc.)
 */
export function captureTarget(
  el: HTMLElement,
  clickPoint: { x: number; y: number },
): TargetingResult {
  // Walk up looking for data-feedback-id, max 5 levels
  let cursor: HTMLElement | null = el;
  let levels = 0;
  let foundId: string | null = null;
  let snapshotEl: HTMLElement = el;

  while (cursor && levels < MAX_PARENT_WALK) {
    const id = cursor.getAttribute("data-feedback-id");
    if (id) {
      foundId = id;
      snapshotEl = cursor; // snapshot the IDed element, not the leaf click
      break;
    }
    cursor = cursor.parentElement;
    levels++;
  }

  // Compute document-relative percentages
  const docWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth,
    window.innerWidth,
  );
  const docHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    window.innerHeight,
  );

  const x_percent = Math.max(0, Math.min(100, (clickPoint.x / docWidth) * 100));
  const y_percent = Math.max(0, Math.min(100, (clickPoint.y / docHeight) * 100));

  return {
    feedback_id: foundId,
    selector_fallback: null, // dropped per design
    x_percent: Number(x_percent.toFixed(2)),
    y_percent: Number(y_percent.toFixed(2)),
    viewport_width: window.innerWidth,
    element_html: captureElementSnapshot(snapshotEl),
  };
}

/**
 * Resolve a saved pin to its current target element on the page.
 * Returns null if the element can't be found via feedback_id.
 * In that case, the caller should fall back to x_percent / y_percent positioning.
 */
export function resolveTarget(pin: Pick<FeedbackPinRow, "feedback_id">): HTMLElement | null {
  if (!pin.feedback_id) return null;

  // CSS-escape the value to handle any special chars
  const safeId = CSS.escape(pin.feedback_id);
  const found = document.querySelector(`[data-feedback-id="${safeId}"]`);
  return found instanceof HTMLElement ? found : null;
}

/**
 * Returns true if the given element is part of the feedback layer's own UI.
 * Used by the element picker to avoid pinning the toggle button or side panel.
 */
export function isFeedbackUiElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  return el.closest("[data-feedback-ui='true']") !== null;
}
