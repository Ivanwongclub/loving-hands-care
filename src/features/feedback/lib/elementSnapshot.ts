// Capture a privacy-safe snapshot of an HTML element.
// 
// Rationale: We want a visual reference of what was on screen when feedback was 
// pinned, but NOT the actual text content (which may contain resident names, 
// HKIDs, medication names, etc.). We strip text node content but keep tag 
// structure and attributes to preserve visual context.

const MAX_BYTES = 2048; // 2KB cap per spec

/**
 * Returns text-stripped outerHTML of the given element, capped at MAX_BYTES.
 * Text nodes are replaced with their bounding box approximation: a single space.
 * Attribute values are preserved (data-feedback-id, class, etc.) since they 
 * carry no PII.
 */
export function captureElementSnapshot(el: HTMLElement): string {
  // Clone to avoid mutating the original
  const clone = el.cloneNode(true) as HTMLElement;

  // Walk all text nodes, replace with a single space (preserves layout intent 
  // without leaking content)
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let node: Node | null = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }
  for (const t of textNodes) {
    if (t.nodeValue && t.nodeValue.trim().length > 0) {
      t.nodeValue = " ";
    }
  }

  // Get outerHTML, truncate to MAX_BYTES (UTF-8 safe)
  const html = clone.outerHTML;
  return truncateUtf8(html, MAX_BYTES);
}

function truncateUtf8(s: string, maxBytes: number): string {
  // Rough but safe: TextEncoder gives byte length, we slice characters until under cap
  const encoder = new TextEncoder();
  if (encoder.encode(s).byteLength <= maxBytes) return s;
  
  // Binary search character count down to fit
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (encoder.encode(s.slice(0, mid)).byteLength <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return s.slice(0, lo);
}
