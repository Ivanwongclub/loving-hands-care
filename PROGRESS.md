# HMS Progress Log

## Session: 2026-05-01

---

## ✅ Completed this session

### HMS Feedback Layer — F4 (carried over from previous session)
- Built `useFeedbackPins.ts` — useQuery with 60s polling, filters out closed pins
- Built `useFeedbackPinMutations.ts` — createPin mutation; passes `pin_number: 0` as placeholder (DB trigger `feedback_pins_assign_number` overwrites before commit)
- Built `FeedbackCommentBox.tsx` — fixed-position comment box, clamps left position to avoid overlap with 320px side panel
- Built `FeedbackPin.tsx` — numbered circular pin marker with status colour map
- Built `FeedbackPinsLayer.tsx` — createPortal to document.body, rAF position tracking, `pointerEvents: none` wrapper
- Built `FeedbackSidePanel.tsx` — fixed right panel (320px), opens when `isOn || activePinId !== null`
- Updated `FeedbackOverlay.tsx` — replaced console.log with PendingCapture state → mounts FeedbackCommentBox on element click
- Updated `FeedbackProvider.tsx` — added FeedbackPinsLayer + FeedbackSidePanel; SSR guard via `hydrated` state (setHydrated in useEffect)
- Updated `en.json` + `zh-HK.json` — full `feedback.*` i18n namespace added (parity confirmed)

### F4 Bug Fixes
- **pin_number race condition**: Removed manual MAX(pin_number)+1 query; now passes `pin_number: 0` and lets the DB trigger handle assignment atomically
- **Comment box hidden behind side panel**: Added `SIDE_PANEL_WIDTH = 320` constant; updated left-clamp formula to `Math.max(16, Math.min(rawLeft, window.innerWidth - SIDE_PANEL_WIDTH - BOX_WIDTH - 16))`

### Pre-F5 Audit (read-only)
- Full sprint completion audit (S1–S15, F1–F4) delivered
- Corrected previous audit errors:
  - Pass Mode IS implemented — lives in `emar.tsx` + `src/components/emar/`, not in `emar.$residentId.tsx`
  - Settings has **7 sections** (branches, staff, alerts, notifications, emar, familyPortal, system) — not 4 as previously thought
  - `system_job_runs` table confirmed present in migration `20260428_system_jobs_tables.sql` and `types.ts` — S15-A is complete

### Critical Bug Fix — TanStack Router missing `<Outlet />`
- **Root cause diagnosed**: All dotted child routes (e.g. `residents.$id`, `staff.$id`) have `getParentRoute: () => ParentRoute` in `routeTree.gen.ts`. Parent components never rendered `<Outlet />`, so clicking a row updated the URL but the child component never mounted — appeared as "nothing happens".
- **Fix pattern**: Add `useLocation` + `Outlet` to imports, insert pathname guard after all hooks and before the main `return (`:
  ```tsx
  const { pathname } = useLocation();
  if (pathname !== "/residents") return <Outlet />;
  ```
- **Applied to**:
  - `src/routes/residents.tsx` — unlocks `residents.$id.tsx` (2,560 lines) and `residents.new.tsx` (839 lines)
  - `src/routes/staff.tsx` — unlocks `staff.$id.tsx` (418 lines)
  - `src/routes/alerts.tsx` — unlocks `alerts.wallboard.tsx` (43 lines)
- **Skipped** (children are true stubs): `emar.tsx`, `care-plans.tsx`, `vitals.tsx`, `tasks.tsx`
- **git diff --stat**: `3 files changed, 12 insertions(+), 3 deletions(-)` — surgical, no side effects

### Stub verification (Phase 1 of bug fix)
Confirmed which "stubs" were real pages hidden by the Outlet bug:

| File | Lines | Status |
|------|-------|--------|
| `residents.$id.tsx` | 2,560 | REAL — was always built |
| `staff.$id.tsx` | 418 | REAL — was always built |
| `alerts.wallboard.tsx` | 43 | REAL — was always built |
| `residents.new.tsx` | 839 | REAL — was always built |
| `emar.$residentId.tsx` | 6 | TRUE STUB |
| `care-plans.tsx` | 6 | TRUE STUB |
| `care-plans.$id.tsx` | 6 | TRUE STUB |
| `vitals.assessments.tsx` | 6 | TRUE STUB |
| `tasks.handover.tsx` | 6 | TRUE STUB |

---

## 🔄 In progress

- **F4 feedback layer** — code complete and committed; awaiting user verification in preview that pins, comment box, and side panel work end-to-end
- **Outlet fix** — code complete (`git diff` clean, 3 files only); awaiting push + preview verification

---

## ⏭️ Next steps

### Immediate (verify this session's work)
1. Push to GitHub → Lovable.dev preview
2. Test resident row click → `/residents/[id]` → detail page renders
3. Test staff row click → `/staff/[id]` → detail page renders
4. Test alerts wallboard link → `/alerts/wallboard` → wallboard renders
5. Test new admission button → `/residents/new` → form renders
6. Test F4 feedback: toggle feedback mode on, click element, type comment, submit → pin appears

### F5 Sprint (next sprint — not yet planned)
Remaining true stubs to build:
- **`emar.$residentId.tsx`** — per-resident eMAR administration (Pass Mode is in `emar.tsx` but per-resident sub-route is unbuilt)
- **`care-plans.tsx` + `care-plans.$id.tsx`** — standalone care plan routes (ICP data exists in DB and `residents.$id.tsx`, routes are stubs)
- **`vitals.assessments.tsx`** — vitals assessments route
- **`tasks.handover.tsx`** — shift handover report
- **`import.tsx`** — bulk import

### STARTUP_REPORT.md
- Still has open Critical/High/Medium issues (C1–C8, H1–H9, M1–M7)
- Key outstanding: `FEEDBACK_ENABLED` hardcoded `true` in config — needs env var gate before wider rollout (C8)

---

## 🚧 Blockers & decisions

### Decisions made this session
- **`pin_number` assignment**: DB trigger (`feedback_pins_assign_number`) handles MAX+1 atomically; client always passes `0` as placeholder. Do not revert to client-side MAX query.
- **Outlet pattern**: Used `useLocation().pathname` check rather than `useChildMatches()` (unavailable without node_modules to verify) or `useMatch` (ambiguous strict/non-strict behavior). Pathname check is simple and correct for all routes in this project.
- **Stub routes not fixed**: `emar.tsx`, `vitals.tsx`, `tasks.tsx`, `care-plans.tsx` Outlet fix intentionally skipped — their child routes are true stubs and adding Outlet would have no visible effect.

### Known gaps / watch items
- `bun` is not on PATH in the Claude Code shell session — TypeScript checks must be run manually (`bun tsc --noEmit`) or via Lovable.dev preview build
- `emar.$residentId.tsx` is a TRUE STUB — if someone navigates to `/emar/[residentId]` they get "Coming Soon". The Outlet fix was NOT applied to `emar.tsx` since the child is unbuilt.
- Family portal routes (`/family/*`) are excluded from FeedbackProvider — intentional, confirmed in `FeedbackProvider.tsx` EXCLUDED_PREFIXES.
