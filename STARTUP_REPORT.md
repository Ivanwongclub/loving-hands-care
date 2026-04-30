# STARTUP_REPORT.md
**Audit Date:** 2026-05-01  
**Project:** Loving Hands Care — HMS (Helping Hand 伸手助人協會)  
**Stack:** TanStack Start + React 19 + Tailwind v4 + Supabase + Lovable.dev

---

## 🔴 CRITICAL (fix immediately, no approval needed)

### C1 — Google Fonts loaded at runtime
**File:** `src/styles.css:1`
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+HK:wght@400;500;600;700;800&display=swap');
```
**Impact:** 300–500ms added to initial render. Render-blocking on first load. Violates LCP and FCP targets.  
**Fix:** Self-host Inter and Noto Sans HK in `src/assets/fonts/`. Replace import with `@font-face` declarations. Add `<link rel="preload">` tags in `__root.tsx`.

---

### C2 — No font preload in document head
**File:** `src/routes/__root.tsx` — `head()` function  
No `<link rel="preload" as="font" crossOrigin="anonymous">` tags. FOUT (Flash of Unstyled Text) on every page load even once fonts are self-hosted.  
**Fix:** Add preload links for each `.woff2` variant used, inside the `links: []` array in `head()`.

---

### C3 — No route-based code splitting
**File:** `src/routeTree.gen.ts`  
All route imports are static. Zero `createLazyFileRoute()` entries. Every route ships in the initial JS bundle.  
**Impact:** Entire app must be parsed before any page renders. Directly harms TTI and TBT as the app grows.  
**Fix:** Convert route files to use `createLazyFileRoute` (TanStack Router's built-in per-route code splitting).

---

### C4 — No PageWrapper / no page transitions
`src/components/layout/` directory does not exist. No opacity fade, no `AnimatePresence`. TanStack Router performs instant DOM swaps — visible white flash between every navigation.  
**Fix:** Create `src/components/layout/PageWrapper.tsx` with a minimum 150ms CSS opacity fade applied on route entry.

---

### C5 — Hardcoded hex colors across components and new feedback feature
**Existing violations (hms components + routes):**

| File | Line(s) | Value | Fix |
|------|---------|-------|-----|
| `src/components/hms/Feedback.tsx` | 29, 37 | `#fff` | → `var(--text-inverse)` |
| `src/components/hms/Patterns.tsx` | 233 | `#fff` | → `var(--text-inverse)` |
| `src/components/hms/Data.tsx` | 289 | `#fff` | → `var(--text-inverse)` |
| `src/components/hms/Data.tsx` | 46 | `fontSize: 32` | → use `type-h1` class |
| `src/routes/alerts.wallboard.tsx` | 27 | `#fff` | → `var(--text-inverse)` |

**New violations in feedback feature — wrong token names (fallback hex always renders):**

| File | Line | Token used | Problem | Correct token |
|------|------|-----------|---------|--------------|
| `FeedbackToggleButton.tsx` | 39 | `var(--color-primary, #4f46e5)` | `--color-primary` doesn't exist in HMS | `var(--action-primary)` |
| `FeedbackToggleButton.tsx` | 40 | `var(--text-on-primary, #fff)` | `--text-on-primary` doesn't exist | `var(--text-inverse)` |
| `FeedbackElementHighlight.tsx` | 32 | `var(--color-primary, #4f46e5)` | Same — doesn't exist | `var(--action-primary)` |
| `FeedbackElementHighlight.tsx` | 34 | `rgba(79, 70, 229, 0.08)` | Pure hardcoded RGBA | `rgba from --action-primary` |

**Root cause:** Feedback uses generic token names not present in the HMS system. The correct mappings are `--color-primary` → `var(--action-primary)`, `--text-on-primary` → `var(--text-inverse)`, `--radius-full` → `var(--radius-pill)`.

---

### C6 — `FEEDBACK_ENABLED = true` hardcoded + `console.log` in production path
**Files:** `src/features/feedback/config.ts:5`, `src/features/feedback/components/FeedbackOverlay.tsx:35`

```ts
// config.ts — never flipped for production
export const FEEDBACK_ENABLED = true;

// FeedbackOverlay.tsx:35 — fires every time staff click in feedback mode
console.log("[feedback F3] captured target:", {
  route: getCurrentRoute(),
  element_html: ...,   // ≤2KB of DOM content
  selector_fallback: ...,
  x_percent, y_percent, viewport_width,
});
```

**Impact:**  
1. Internal DOM structure, CSS selectors, page routes, and coordinates are logged to the browser console in production.  
2. The `console.log` is explicitly an F3 placeholder — unfinished feature code is live.  
3. `index.tsx` documents the flag should read from `VITE_ENABLE_FEEDBACK` env var, but `config.ts` ignores env vars entirely.

**Fix:**
```ts
// config.ts
export const FEEDBACK_ENABLED = import.meta.env.VITE_ENABLE_FEEDBACK === "true";
```
Set `VITE_ENABLE_FEEDBACK=false` in the Lovable.dev production env until F4 (comment box + DB save) is complete. This dead-code-eliminates the entire feedback module from the production bundle.

---

### C7 — Dashboard bypasses React Query for all data — no error states
**File:** `src/routes/dashboard.tsx:108–199`  
The `refreshAll()` function fetches census, today's tasks, DCU check-ins, meds due next 2h, incidents, and activity via raw `useEffect` + `Promise.all` + `setState`. None go through React Query.

**Consequences:**
- Data is **not cached** — full 6× Supabase round-trip on every dashboard mount
- **Zero error state** — a silent query failure shows "0" in every stat card (clinical staff may miss critical alerts)
- **No stale-while-revalidate** — full spinner on every revisit
- 60-second polling continues while tab is backgrounded

**Contrast:** Every other data-heavy route uses `useQuery` with `staleTime: 5min`.  
**Fix:** Extract each source into a `useQuery` hook (`useDashboardCensus`, `useTodayTasks`, `useMedsDue`, etc.). Add an error banner when any query fails.

---

## 🟠 HIGH (ask approval before fixing)

### H1 — No layout component directory
`src/components/layout/` does not exist. Shell components (`AdminDesktopShell`, `FamilyShell`, `WardTabletShell`, `KioskShell`) duplicate nav/header/layout logic independently.  
**Fix:** Extract shared layout primitives; shells consume them.

---

### H2 — Vitals page uses raw `useEffect` + `useState` for server data
**File:** `src/routes/vitals.tsx:45–63`  
Abnormal vitals fetched via manual `useEffect`. Error is silently swallowed (no UI feedback). No caching, no stale-while-revalidate.  
**Fix:** `useAbnormalVitals(branchId)` hook backed by `useQuery`.

---

### H3 — 5 font weights loaded (max 3 recommended)
Both Inter and Noto Sans HK load weights 400, 500, 600, 700, 800.  
**Fix:** When self-hosting (C1), subset to weights 400, 600, 800 for Inter; 400, 700 for Noto Sans HK.

---

### H4 — No design-system/tokens TypeScript directory
`src/design-system/tokens/` does not exist. Tokens exist only as CSS custom properties — no type safety, no IDE autocomplete in JS/TS context.  
**Fix:** Generate `colors.ts`, `typography.ts`, `spacing.ts`, `index.ts` mirroring `styles.css`.

---

### H5 — No branch selection context — `branches[0]` hardwired in 25 files
`branches[0]` used as the active branch everywhere. Every new route added continues the pattern. Orgs with multiple branches are silently locked to the first branch Supabase returns.

**Affected files (sample):** `dashboard.tsx`, `residents.tsx`, `staff.tsx`, `tasks.tsx`, `alerts.tsx`, `incidents.tsx`, `vitals.tsx`, `emar.tsx`, `audit.tsx`, `reports.tsx`, `settings.tsx`, `attendance.kiosk.tsx`, `attendance.register.tsx`, `attendance.enrollments.tsx`, `AdminDesktopShell.tsx`, `KioskShell.tsx`, `WardTabletShell.tsx` + 8 more.  
**Fix:** `BranchContext` storing selected branch ID (default: `branches[0]`), a switcher in the sidebar, all consumers read from context.

---

### H6 — Kiosk route loads resident data without auth guard
**File:** `src/routes/attendance.kiosk.tsx`  
The kiosk QR scanner loads resident names, photos, and high-risk flags via `useResidents()` with no `<ProtectedRoute>`. An unauthenticated user navigating directly to `/attendance/kiosk` can see resident personal data in the manual-override search drawer. Supabase RLS is the only barrier.  
**Fix:** Wrap in `<ProtectedRoute>` or add a kiosk PIN/session check before resident data loads.

---

### H7 — `FeedbackProvider` polls route via `setInterval(500ms)`
**File:** `src/features/feedback/components/FeedbackProvider.tsx:33`
```ts
const interval = window.setInterval(check, 500);
```
Detects route changes by polling `window.location.pathname` every 500ms. Fires continuously on every page for every logged-in staff member while `FEEDBACK_ENABLED=true`.  
**Impact:** 2 DOM reads/sec, indefinitely, while the app is open — unnecessary CPU/battery drain on tablets.  
**Fix:** Replace with `useLocation()` from `@tanstack/react-router`:
```ts
const location = useLocation();
useEffect(() => {
  setExcluded(isCurrentRouteExcluded());
}, [location.pathname]);
```

---

## 🟡 MEDIUM

### M1 — Arbitrary `text-[0.8rem]` in shadcn/ui base components
**Files:** `src/components/ui/calendar.tsx:79,85`, `src/components/ui/form.tsx:131,153`  
**Fix:** Replace with `type-caption` utility class (12px/16px).

### M2 — Missing standard CSS token aliases
`--color-primary`, `--text-on-primary`, `--radius-full` and other CLAUDE.md standard names are absent from `styles.css`. Any code using these names (including the feedback feature) silently falls back to hardcoded hex.  
**Fix:** Add alias custom properties in `:root` mapping to HMS equivalents. This also resolves C5 feedback token fallbacks.

### M3 — No list virtualization
**Files:** `src/routes/residents.tsx`, `src/routes/staff.tsx`, `src/routes/tasks.tsx`  
Tasks list fetches up to `pageSize: 200` rows with no virtualization.  
**Fix:** Add `@tanstack/react-virtual` when row counts regularly exceed 100.

### M4 — Logo image missing explicit width (CLS risk)
**File:** `src/routes/login.tsx:64` — `width: "auto"` prevents the browser reserving space before load.  
**Fix:** Add explicit `width={112}` (or actual pixel width).

### M5 — `residents.$id.tsx` is 2,560 lines
Single route file contains resident profile, ICP, DNACPR, vitals, medications, incidents, photo management, wandering risk, and advance directive. Entire component is parsed even for sections not visited.  
**Fix:** Extract each tab panel into `src/components/residents/`. Route file should be < 200 lines of wiring.

### M6 — Dashboard silent failure on data fetch error
Related to C7. If any of the 6 raw `useEffect` fetches fail, all stat cards silently show "0". Clinical staff relying on "0 open alerts" could miss a critical event.  
**Fix:** Add `try/catch` around `refreshAll()` and surface an error banner. (Full fix: migrate to `useQuery` per C7.)

### M7 — Feedback F3 gives no visible feedback to user on click
**File:** `src/features/feedback/components/FeedbackOverlay.tsx`  
Staff click an element in feedback mode — nothing visible happens (just a `console.log`). The UX is confusing until F4 (comment box) is built.  
**Fix:** Either gate with `VITE_ENABLE_FEEDBACK` flag (preferred, per C6), or show a temporary toast: "Feedback captured — comment box coming soon."

---

## 🟢 LOW

### L1 — Font subsetting not applied
Inter and Noto Sans HK load full character sets. Subsetting to Latin + Traditional Chinese (HK) would reduce file size ~40%.

### L2 — No skip-to-main-content link
No skip-nav link in any shell component. Required for keyboard / screen reader accessibility.

### L3 — Language toggle button missing `aria-label`
**File:** `src/components/shells/AdminDesktopShell.tsx:273`  
`<button onClick={toggleLang}>` has no `aria-label`.  
**Fix:** `aria-label={i18n.language === "en" ? "Switch to Chinese" : "切換至英文"}`

---

## SUMMARY TABLE

| # | Severity | Issue | File(s) |
|---|----------|-------|---------|
| C1 | 🔴 Critical | Google Fonts at runtime | `styles.css:1` |
| C2 | 🔴 Critical | No font preload in `<head>` | `__root.tsx` |
| C3 | 🔴 Critical | No route code splitting | `routeTree.gen.ts` |
| C4 | 🔴 Critical | No PageWrapper / page transitions | (missing) |
| C5 | 🔴 Critical | Hardcoded hex + wrong token names | `hms/Feedback.tsx`, `hms/Patterns.tsx`, `hms/Data.tsx`, `alerts.wallboard.tsx`, `FeedbackToggleButton.tsx`, `FeedbackElementHighlight.tsx` |
| C6 | 🔴 Critical | `FEEDBACK_ENABLED=true` + `console.log` in production | `feedback/config.ts`, `FeedbackOverlay.tsx` |
| C7 | 🔴 Critical | Dashboard bypasses React Query — no error states | `routes/dashboard.tsx` |
| H1 | 🟠 High | No layout component directory | (missing) |
| H2 | 🟠 High | Vitals raw `useEffect` for server data | `routes/vitals.tsx` |
| H3 | 🟠 High | 5 font weights loaded | `styles.css:1` |
| H4 | 🟠 High | No design-system/tokens TS directory | (missing) |
| H5 | 🟠 High | `branches[0]` hardwired in 25 files | systemic |
| H6 | 🟠 High | Kiosk route loads resident data without auth guard | `attendance.kiosk.tsx` |
| H7 | 🟠 High | FeedbackProvider polls route every 500ms | `FeedbackProvider.tsx:33` |
| M1 | 🟡 Medium | Arbitrary `text-[0.8rem]` | `calendar.tsx`, `form.tsx` |
| M2 | 🟡 Medium | Missing standard CSS token aliases | `styles.css` |
| M3 | 🟡 Medium | No list virtualization | `residents.tsx`, `tasks.tsx` |
| M4 | 🟡 Medium | Logo img missing explicit width | `login.tsx:64` |
| M5 | 🟡 Medium | `residents.$id.tsx` 2,560 lines | `routes/residents.$id.tsx` |
| M6 | 🟡 Medium | Dashboard silent failure on fetch error | `routes/dashboard.tsx` |
| M7 | 🟡 Medium | Feedback F3 no visible user feedback | `FeedbackOverlay.tsx` |
| L1 | 🟢 Low | Font subsetting not applied | `styles.css` |
| L2 | 🟢 Low | No skip-to-main-content link | shell components |
| L3 | 🟢 Low | Language toggle missing `aria-label` | `AdminDesktopShell.tsx:273` |

---

## WHAT'S GOOD ✅

- All previously unguarded routes now protected via `<ProtectedRoute>` or `AdminStubPage` ✅
- WardTabletShell reads live staff name from `useCurrentStaff()` ✅
- Dashboard has full Skeleton coverage on stat cards, tasks table, and handover ✅
- Dashboard task table and activity feed show real Supabase data ✅
- Family Portal uses `FamilyProtectedRoute` correctly ✅
- `family.dashboard.tsx` uses `useQuery` for all data ✅
- Feedback feature is correctly lazy-loaded via `React.lazy()` + `Suspense` in `__root.tsx` ✅
- Feedback correctly excludes `/family/*` and `/attendance/kiosk` routes ✅
- Feedback is role-gated (`FEEDBACK_VISIBLE_TO_ROLES`) ✅
- `FeedbackToggleButton` has correct `aria-label` ✅
- `FeedbackElementHighlight` uses `requestAnimationFrame` for position tracking ✅
- Sidebar reorganized into logical sections (Clinical / DCU / Management / System) ✅
- All data hooks except dashboard + vitals use React Query with `staleTime: 5min` ✅
- Search inputs debounced at 300ms ✅
- Skeleton loading on all major list views ✅
- EmptyState components on all list views ✅
- Error handling on all mutations via `toast.error` ✅
- Single icon library (Lucide React) ✅
- Supabase queries paginated (range-based) ✅
- `scrollRestoration: true`, `defaultPreload: "intent"` on router ✅
- `defaultPendingComponent` + `defaultPendingMs: 100` configured ✅
- i18n EN/ZH-HK implemented ✅
- Design tokens comprehensive and well-structured in `styles.css` ✅
