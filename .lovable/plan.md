

## Sidebar Refinements — Login Logo + Floating Collapse Toggle

Update `src/components/shells/AdminDesktopShell.tsx` only.

### 1. Use the existing login-page logo
- Replace the import `@/assets/logo.png` with `@/assets/helping-hand-logo.webp` (same asset used on `/login`).
- Render at ~48px tall, centered, above the "HMS" wordmark.
- Do NOT generate or create a new logo asset.

### 2. Replace the collapse toggle with a floating, enterprise-grade control
- Remove the current `PanelLeftClose` / `PanelLeftOpen` button from inside the sidebar header.
- Add a new circular floating toggle button positioned near the **bottom** of the sidebar's right edge, half-overlapping outside the sidebar (classic enterprise pattern, e.g. Notion / Linear / Vercel).
- Placement (absolute positioning on the `<aside>`):
  - `position: absolute; bottom: 96px; right: -12px;` (half of the 24px button sits outside the sidebar)
  - `width: 24px; height: 24px;` perfectly circular
  - Background: `var(--bg-surface)`, border: `1px solid var(--border-subtle)`, subtle shadow `0 2px 6px rgba(0,0,0,0.08)`
  - Hover: background `var(--bg-hover-subtle)`, border `var(--border-default)`
  - Icon: `ChevronLeft` (expanded) / `ChevronRight` (collapsed) from lucide at size 14, color `var(--text-secondary)`
  - `z-index` above sidebar content; `border-radius: 50%`
  - Smooth icon rotation/swap on toggle

### 3. Keep everything else from the previous turn
- Collapsed width `64px`, expanded `var(--sidebar-width)`, transition preserved
- All collapse behaviors (hidden labels, hidden section titles, hidden ContextSwitcher, avatar-only user chip) unchanged
- Top bar `left` and main `marginLeft` continue to track sidebar width

### Files Touched
- `src/components/shells/AdminDesktopShell.tsx` (only)

### Out of Scope
- No new assets, no i18n changes, no other files modified

