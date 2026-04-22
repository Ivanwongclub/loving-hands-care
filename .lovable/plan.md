

## Sidebar Updates — Logo, Centered Title, Collapse

Update `src/components/shells/AdminDesktopShell.tsx` to refine the sidebar header and add collapse functionality.

### Changes

**1. Header (top of sidebar)**
- Add logo image above the "HMS" wordmark
- Center-align both logo and "HMS" text
- Remove the "HMS 伸手助人協會" subtitle line
- When collapsed: show only the centered "HMS" text logo (no image, no subtitle)

**2. Collapse functionality**
- Add local `collapsed` state (`useState<boolean>`)
- Add a toggle button (chevron icon, lucide `PanelLeftClose` / `PanelLeftOpen`) pinned at the top-right corner of the sidebar header
- When collapsed:
  - Sidebar width shrinks from `var(--sidebar-width)` to `64px` (icon-only mode)
  - Nav items hide their text labels — show icons only, centered
  - Section title labels (`OPERATIONS`, `MANAGEMENT`, `SYSTEM`) hide
  - Branch ContextSwitcher hides
  - User chip at the bottom shows only the avatar (centered), name/role/sign-out hidden — sign-out becomes a small icon button below avatar
  - Top bar `left` offset switches to `64px`
  - Main content `margin-left` switches to `64px`
- Smooth width transition using CSS `transition: width var(--duration-normal)`

**3. Layout adjustments**
- Replace inline `width: var(--sidebar-width)` with a dynamic value driven by `collapsed` state on the `<aside>`, top `<header>`, and `<main>`
- Keep all existing nav items, sections, and behavior intact (including the external `/attendance/kiosk` button)
- Logo image: use a placeholder path `/logo.png` (existing public asset convention) — if no asset exists, render a simple SVG circle/monogram placeholder so build doesn't break

### Files Touched

- `src/components/shells/AdminDesktopShell.tsx` (only file changed)

### Out of Scope

- No changes to tokens, i18n keys, hooks, shells/ structure beyond this single shell file
- No new routes or backend changes
- Collapsed state is local (not persisted) — can persist to localStorage in a follow-up if desired

