// Match the current browser route against pin.page_route values.
//
// Normalization rules (per design lock):
//   - Path params: KEEP CONCRETE (e.g. /residents/abc-123 ≠ /residents/xyz-789)
//   - Query params: STRIP (e.g. ?tab=profile is ignored)
//   - Hash: STRIP
//   - Trailing slashes: STRIP

/**
 * Normalize a URL path/route for storage and comparison.
 * Always strips query string and hash, removes trailing slash (except for root "/").
 */
export function normalizeRoute(input: string): string {
  // Drop query string + hash
  let path = input.split("?")[0].split("#")[0];
  
  // Drop trailing slash (but keep root "/")
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  
  return path || "/";
}

/**
 * Get the current route from window.location.
 * Safe to call from useEffect (not during SSR).
 */
export function getCurrentRoute(): string {
  if (typeof window === "undefined") return "/";
  return normalizeRoute(window.location.pathname);
}

/**
 * Get a human-readable page title for storage on a pin.
 */
export function getCurrentPageTitle(): string {
  if (typeof document === "undefined") return "";
  return document.title || "";
}
