// Compute pixel positions for rendering pin markers on top of target elements.
//
// Strategy:
//   1. If pin has feedback_id and element exists: use bounding rect, top-right corner
//   2. Else: use x_percent/y_percent against current document size
//
// Returned position is document-relative (top/left from document origin), so
// pin markers should be rendered with position: absolute relative to a
// document-anchored container.

import type { FeedbackPinRow, PinPosition } from "../types";
import { resolveTarget } from "./elementTargeting";

const PIN_OFFSET = 8; // px, pin overlaps target slightly

/**
 * Compute the current document-relative position for a pin marker.
 */
export function computePinPosition(pin: FeedbackPinRow): PinPosition {
  // Try resolving via feedback_id first
  const el = resolveTarget(pin);

  if (el) {
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY - PIN_OFFSET,
      left: rect.right + window.scrollX - PIN_OFFSET,
      visible: rect.width > 0 && rect.height > 0,
    };
  }

  // Fallback: x_percent / y_percent
  if (pin.x_percent !== null && pin.y_percent !== null) {
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
    return {
      top: (Number(pin.y_percent) / 100) * docHeight,
      left: (Number(pin.x_percent) / 100) * docWidth,
      visible: true,
    };
  }

  // No targeting info at all — shouldn't happen, but guard
  return { top: 0, left: 0, visible: false };
}
