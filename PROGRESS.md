# HMS Progress Log

## Session: 2026-05-02

---

## ✅ Completed this session

### HMS F5 — Retrofit `data-feedback-id` attributes

**Phase 1 — Attribute sprint (3 pages)**

- **`src/routes/dashboard.tsx`** — added `data-feedback-id` to 4 stat card wrappers (dynamic IDs per `c.key`), tasks panel, and recent-activity panel
- **`src/routes/emar.tsx`** — added to outer Stack (`emar-root`), pass-mode toggle buttons (`emar-pass-mode-toggle`), stats grid (`emar-stat-bar`), FilterBar (`emar-filter-bar`), SearchField (`emar-search`)
- **`src/routes/residents.$id.tsx`** — extended internal `TabGroup` function with optional `feedbackId` prop forwarded as `data-feedback-id`; added to root Stack, ProfileHeader Surface, ResidentPhoto div, clinical tab group, ProfileTab Stack, ContactsTab Stack, ActivityTab Card

**Phase 2 — Audit (read-only)**
- Confirmed Stack/Surface/Card/Button/Badge all extend `HTMLAttributes<T>` and forward `data-*` — safe to annotate
- Confirmed Modal and FilterBar do NOT forward `data-*` — interface gap (critical fixes C1, C2)
- Confirmed `PassModeView.tsx` used static repeating IDs on per-item elements — bug C3
- Confirmed 5 tab components (vitals, icp, incidents, restraints, vaccinations) were excluded from F5 scope — C4

**Phase 3 — Cleanup fixes (4 critical issues resolved)**

- **C1+C3 — `src/components/hms/Overlays.tsx` (Modal):** Added `"data-feedback-id"?: string` to `ModalProps`, destructured as `feedbackId`, applied to inner panel `<div>` (not backdrop). Confirmed `emar-pin-dialog` now lands on the correct DOM node.
- **C2+C3 — `src/components/hms/Patterns.tsx` (FilterBar):** Added `"data-feedback-id"?: string` prop + forwarded to wrapper div. Removed accidental `HTMLAttributes` import that caused TS error.
- **C3 — `src/components/emar/PassModeView.tsx`:** Switched from static `"emar-resident-card"` / `"emar-medication-row"` to per-item unique IDs using resident UUID and record UUID. Added `"emar-pass-mode-view"` to outer Stack.
- **C4 — 5 tab components:** Added `data-feedback-id` to outer Stack/Card in `VitalsTab`, `ICPTab`, `IncidentsTab`, `RestraintsTab`, `VaccinationsTab`.

**Phase 4 — Infinite loop diagnosis (read-only)**

Diagnosed two "Maximum update depth exceeded" errors in `FeedbackPinsLayer.tsx`:

- **Bug 1:** `const { data: pins = [] }` — destructuring default `[]` creates a NEW array reference every render when `data` is `undefined` (loading state). This makes `pins` change identity each render, re-triggering the `useEffect([pins])`.
- **Bug 2:** `setPositions({})` — creates a NEW object reference each call; React cannot bail out (no same-reference check). Combined with Bug 1, creates a tight synchronous re-render loop (~50 iterations → crash).
- **Why two errors:** React 18 Strict Mode double-mounts effects (mount → unmount → re-mount), so the loop fires twice independently.

**Phase 5 — Infinite loop fixes applied**

Fixed `src/features/feedback/components/FeedbackPinsLayer.tsx`:

- **Fix 1:** Added `const EMPTY_PINS: FeedbackPinRow[] = [];` at module level (after imports). Changed destructure to `const { data: pins = EMPTY_PINS } = useFeedbackPins();`. Module-level constant has stable identity across all renders — React's `useEffect` dep comparison now bails out correctly when data is still loading.
- **Fix 2:** Changed `setPositions({})` to `setPositions((prev) => Object.keys(prev).length === 0 ? prev : {});`. Functional updater returns `prev` unchanged when already empty — React bails out (same reference, no re-render). Only allocates a new `{}` on the first call when positions actually need clearing.

Verified with grep: lines 11, 14, 24 all correct.

---

## 🔄 In progress

- **F5 + feedback layer fixes** — all code changes complete, not yet pushed to GitHub / verified in Lovable.dev preview
- **Infinite loop fix** — applied locally; needs browser verification that "Maximum update depth exceeded" errors no longer appear in console when feedback mode loads

---

## ⏭️ Next steps

### Immediate (verify this session's work)
1. Push to GitHub via GitHub Desktop → Lovable.dev preview
2. Open browser console — confirm zero "Maximum update depth exceeded" errors
3. Toggle feedback mode on → confirm pins render and no crash
4. Spot-check `data-feedback-id` attributes in DevTools Elements panel on dashboard, eMAR, and resident detail

### Fix #3 (explicitly deferred, not blocking)
- `FeedbackElementHighlight.tsx` runs a 60fps rAF loop calling `setRect` — not an infinite loop crash but causes unnecessary re-renders when the highlight is active. Consider switching to ResizeObserver + scroll listener for position tracking. Low priority — address separately.

### F6 Sprint (next planned sprint)
- Build the feedback side panel interactions (pin threading, reply, resolve/close flows)
- Add `FEEDBACK_ENABLED` env var gate (currently hardcoded `true` in config — C8 from STARTUP_REPORT)

### Remaining true stubs to build (unchanged from previous session)
- `emar.$residentId.tsx` — per-resident eMAR sub-route
- `care-plans.tsx` + `care-plans.$id.tsx` — standalone care plan routes
- `vitals.assessments.tsx` — vitals assessments route
- `tasks.handover.tsx` — shift handover report
- `import.tsx` — bulk import

---

## 🚧 Blockers & decisions

### Decisions made this session
- **`EMPTY_PINS` pattern over inline default:** Module-level constant chosen over `useMemo(() => [], [])` — simpler, no hook overhead, identical stability guarantee. Only viable because the array is never mutated.
- **Functional `setPositions` updater:** Chosen over `useRef` to track previous positions — keeps positions as reactive state (needed for render), avoids an extra ref, and the cost is just one `Object.keys()` call per effect tick when pins are empty.
- **Fix #3 deferred:** 60fps rAF in `FeedbackElementHighlight.tsx` is a performance concern but NOT the crash root cause. Excluded from this fix to keep scope minimal and not risk introducing regressions in the highlight UX.
- **FilterBar `"data-feedback-id"?: string` pattern:** Explicit typed prop chosen over `Pick<HTMLAttributes<HTMLDivElement>, "data-feedback-id">` — `Pick` on index signatures does not work cleanly in TypeScript; explicit string prop is simpler and consistent with Modal pattern.

### Known gaps / watch items
- `bun` is not on PATH in Claude Code shell — TypeScript checks must be run manually or via Lovable.dev preview build
- `emar.$residentId.tsx` is a TRUE STUB — navigating to `/emar/[residentId]` shows "Coming Soon"
- Family portal routes (`/family/*`) are excluded from FeedbackProvider — intentional, confirmed in `EXCLUDED_PREFIXES`
- STARTUP_REPORT.md still has open C1–C8, H1–H9, M1–M7 items; C8 (`FEEDBACK_ENABLED` hardcoded) is the most urgent before wider rollout
