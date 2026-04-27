# STARTUP_REPORT.md
**Audit Date:** 2026-04-27  
**Project:** Loving Hands Care — HMS (Helping Hand 伸手助人協會)  
**Stack:** TanStack Start + React 19 + Tailwind v4 + Supabase + Lovable.dev

---

## 🔴 CRITICAL (fix immediately, no approval needed)

### C1 — Google Fonts loaded at runtime
**File:** `src/styles.css:1`
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+HK:wght@400;500;600;700;800&display=swap');
```
**Impact:** Adds 300–500ms to initial render. Fonts are render-blocking on first load. Violates LCP and FCP targets.  
**Fix:** Self-host both Inter and Noto Sans HK in `src/assets/fonts/`, replace with `@font-face` declarations, add `<link rel="preload">` tags in `__root.tsx`.

---

### C2 — No font preload in document head
**File:** `src/routes/__root.tsx`  
The `head()` function includes only the CSS stylesheet link. No `<link rel="preload" as="font">` tags are present.  
**Impact:** Even if fonts were self-hosted, they would not be discovered and loaded early — causing FOUT (Flash of Unstyled Text) on every page load.  
**Fix:** Add preload links for each font file variant actually used (woff2 format).

---

### C3 — No route-based code splitting
**Checked:** `src/router.tsx`, all `src/routes/*.tsx`  
No `React.lazy()` or `<Suspense>` wrappers found anywhere. All routes are statically imported and bundled together.  
**Impact:** Full bundle must be parsed before any page renders. As the app grows this will directly harm TTI and TBT scores.  
**Fix:** Wrap each route-level component in `React.lazy()` + `<Suspense fallback={<PageSkeleton />}>`.

---

### C4 — No page transition / PageWrapper (white flash risk)
**Checked:** `src/components/layout/` — **directory does not exist**  
There is no `PageWrapper`, `AnimatePresence`, or any CSS transition applied on route changes. TanStack Router performs instant DOM swaps between routes.  
**Impact:** Users see raw white flash between navigations, degrading perceived performance.  
**Fix:** Create `src/components/layout/PageWrapper.tsx` with at minimum a CSS opacity fade (150ms) using `useTransitionState` or Framer Motion `AnimatePresence`.

---

### C6 — 4 routes missing ProtectedRoute (unauthenticated access possible)
**Files:**
- `src/routes/care-plans.tsx`
- `src/routes/emar.$residentId.tsx`
- `src/routes/tasks.handover.tsx`
- `src/routes/vitals.assessments.tsx`

These routes render their full page content with no auth guard. A user who navigates directly to `/care-plans`, `/emar/:residentId`, `/tasks/handover`, or `/vitals/assessments` without a valid session will see real patient data — or hit Supabase with no auth token.  
**Contrast:** `alerts.wallboard.tsx` wraps its component in `<ProtectedRoute>` correctly.  
**Fix:** Wrap the root component of each affected route in `<ProtectedRoute>`.

---

### C5 — Hardcoded hex colors in multiple components
The following files contain hardcoded hex values instead of CSS custom property references:

| File | Instances | Values |
|------|-----------|--------|
| `src/components/dcu/QRCard.tsx` | 8 | `#ffffff`, `#cccccc`, `#111111`, `#444`, `#eee`, `#555`, `#666`, `#999`, `#111` |
| `src/components/hms/Feedback.tsx:29,37` | 2 | `#fff` (in Badge strong emphasis) |
| `src/components/hms/Patterns.tsx:233` | 1 | `#fff` |
| `src/components/hms/Data.tsx:289` | 1 | `#fff` |
| `src/components/alerts/NotificationBell.tsx:114` | 1 | `#fff` |
| `src/components/ui/chart.tsx:51` | 2 | `#ccc` (recharts internal selectors) |

**Note:** `QRCard.tsx` uses inline styles intentionally for print-faithful rendering (documented in its comment). The `#fff` usages in `Feedback.tsx`, `Patterns.tsx`, `Data.tsx`, and `NotificationBell.tsx` should reference `var(--text-inverse)` or `var(--color-neutral-0)` instead. The recharts `#ccc` selectors are third-party library internals and are acceptable.  
**Fix:** Replace all non-print `#fff` hardcodes with `var(--text-inverse)`. Leave `QRCard.tsx` intentionally exempt (print card).

---

## 🟠 HIGH (ask approval before fixing)

### H1 — No layout component directory
**Expected:** `src/components/layout/Header.tsx`, `Footer.tsx`, `PageWrapper.tsx`, `Container.tsx`  
**Found:** None. Shell components (`AdminDesktopShell`, `FamilyShell`, etc.) duplicate nav/header/layout logic internally.  
**Impact:** Any header/nav change requires editing multiple shell files. No shared Container means max-width handling is inconsistent.  
**Fix:** Extract shared concerns into layout primitives; shells can consume them.

---

### H2 — Dashboard page missing loading and error states
**File:** `src/routes/dashboard.tsx`  
The dashboard calls `useResidents()`, `useTasks()`, `useAlerts()`, and `useBranches()` but never checks `isLoading` or `error` from any of them. While data is fetching, stats render as `"0"` silently. No skeleton, no error banner.  
**Contrast:** Other routes (residents, staff, tasks, alerts, incidents, settings) all correctly show `<Skeleton>` rows during loading.  
**Fix:** Add loading skeleton for the 4 stat cards and recent tasks table. Add error banner if any query fails.

---

### H3 — Vitals page uses raw `useEffect` + `useState` for server data
**File:** `src/routes/vitals.tsx:45–63`  
`abnormal` vitals are fetched via a manual `useEffect` + `supabase` call + local `useState`, bypassing React Query. This means no caching, no stale-while-revalidate, no error state, and the data re-fetches from scratch every time the component mounts.  
**Contrast:** All other data hooks use `useQuery` consistently.  
**Fix:** Move this into a `useAbnormalVitals(branchId)` hook that uses `useQuery`.

---

### H4 — 5 font weights loaded (exceeds recommended 3 max)
Both Inter and Noto Sans HK load weights 400, 500, 600, 700, 800 via Google Fonts.  
The actual design system uses 4 weights (regular, medium, semibold, bold/extrabold). Weight 500 (medium) is rarely used in the codebase.  
**Fix:** When self-hosting (C1), subset to 400, 600, 800 for Inter; 400, 700 for Noto Sans HK.

---

### H6 — Hardcoded staff name in WardTabletShell
**File:** `src/components/shells/WardTabletShell.tsx:37`
```jsx
<Avatar name="Wong KM" />
```
The ward tablet shell renders a hardcoded name instead of reading from `useCurrentStaff()`. Every device running the ward tablet will show "Wong KM" regardless of who is logged in.  
**Fix:** Import `useCurrentStaff` and replace with the live `staff?.name` value (same pattern as `AdminDesktopShell.tsx:70`).

---

### H7 — No branch selection context — `branches[0]` hardwired in 19 files
`branches[0]` is used as the active branch in every route and shell component (19 occurrences). There is no branch-selection context or persisted preference. For any org with more than one branch, every user is silently locked to whichever branch Supabase returns first.  
**Affected files (sample):** `dashboard.tsx`, `residents.tsx`, `staff.tsx`, `tasks.tsx`, `alerts.tsx`, `incidents.tsx`, `vitals.tsx`, `emar.tsx`, `audit.tsx`, `reports.tsx`, `AdminDesktopShell.tsx`, `KioskShell.tsx`, `NotificationBell.tsx`, and 6 more.  
**Fix:** Create a `BranchContext` that stores the selected branch ID (default: `branches[0]`), expose a switcher in the sidebar, and read from context instead of `branches[0]` directly.

---

### H5 — No design-system tokens directory
**Expected:** `src/design-system/tokens/colors.ts`, `typography.ts`, `spacing.ts`, `index.ts`  
**Found:** Design tokens exist only as CSS custom properties in `styles.css`. There are no corresponding TypeScript token files.  
**Impact:** No type safety on token usage, no IDE autocomplete for design values in JS/TS context.  
**Fix:** Generate token TS files mirroring the CSS custom properties in `styles.css`.

---

## 🟡 MEDIUM (optional improvements)

### M1 — Arbitrary font sizes in shadcn/ui base components
**Files:** `src/components/ui/calendar.tsx:79,85`, `src/components/ui/form.tsx:131,153`  
```
text-[0.8rem]
```
These are Lovable.dev / shadcn generated defaults. They won't break anything but violate the no-arbitrary-font-sizes rule.  
**Fix:** Map `text-[0.8rem]` → `type-caption` utility class (12px/16px, closest match).

---

### M2 — Missing CSS token aliases for CLAUDE.md standard names
The global design system spec requires tokens named `--color-primary`, `--color-secondary`, `--color-accent`, `--color-background`, `--color-surface`, `--color-border`, `--font-heading`, `--font-mono`, `--ease-spring`, `--radius-full`, and `--spacing-*` (vs current `--space-*`).  
The project uses a valid but differently-named HMS design system. These aliases don't exist.  
**Fix:** Add alias custom properties to `:root` in `styles.css` that map to the HMS equivalents (e.g., `--color-primary: var(--action-primary)`).

---

### M3 — No list virtualization (not yet critical at current data volumes)
**Files:** `src/routes/residents.tsx`, `src/routes/staff.tsx`, `src/routes/tasks.tsx`  
Lists are rendered with `pageSize: 20–200` rows without virtualization. At current scale this is fine, but the tasks list fetches up to `pageSize: 200` items.  
**Fix:** Monitor in production; add `@tanstack/react-virtual` if row counts regularly exceed 100.

---

### M4 — Dashboard task table and activity feed are entirely mock data
**File:** `src/routes/dashboard.tsx:39–44, 96–100`  
Two full UI sections render hardcoded placeholder content while real data sits unused:
- **Recent Tasks table** (lines 39–44): 5 fake rows (`T-1041` through `T-1045`) with names like "Chan Tai Man · 陳大文" and assignee "RN Lee". Real `useTasks()` is called but only used for the overdue *count* in the stat card.
- **Recent Activity feed** (lines 96–100): 5 hardcoded `ActivityItem` entries with fixed timestamps (`09:42`, `09:38`, etc.) and fake actors ("RN Lee", "HCA Tam", "Dr. Cheung"). No real audit log data is wired in.

Real data is fetched (`useResidents`, `useTasks`, `useAlerts`) but never rendered in the main content area.  
**Fix:** Replace mock rows with real `tasks` from `useTasks()`. Wire the activity feed to the audit log hook (`useAuditLog`) already present in `src/hooks/useAuditLog.ts`.

---

### M5 — Logo image lacks explicit width attribute (minor CLS risk)
**File:** `src/routes/login.tsx:64`  
```jsx
<img src={helpingHandLogo} alt="Helping Hand" style={{ height: 140, width: "auto" }} />
```
Height is set but width is `"auto"`. During the loading phase the browser can't calculate the reserved space without knowing aspect ratio. A small CLS shift may occur on slow connections.  
**Fix:** Add explicit `width={112}` (or actual pixel width) to pre-allocate space.

---

## 🟢 LOW

### L1 — Font subsetting not applied
Both Inter and Noto Sans HK are loaded as full character sets. For an HMS used primarily with Latin + Traditional Chinese (HK), subsetting to `unicode-range` `U+0000-00FF` (Latin) and the relevant CJK range would reduce file size by ~40%.

### L2 — Missing `skip to main content` accessibility link
No skip-nav link exists at the top of any shell component. Required for keyboard/screen reader accessibility compliance.

### L3 — No `aria-label` on some icon-only buttons
The sidebar collapse button (`AdminDesktopShell.tsx:115`) has `aria-label` ✓. The language toggle button (`type-body-sm` button) does not have a descriptive ARIA label — it shows text but no `aria-label` for screen readers.

---

## SUMMARY TABLE

| # | Severity | Issue | File(s) |
|---|----------|-------|---------|
| C1 | 🔴 Critical | Google Fonts at runtime | `styles.css:1` |
| C2 | 🔴 Critical | No font preload in `<head>` | `__root.tsx` |
| C3 | 🔴 Critical | No route code splitting | all `routes/*.tsx` |
| C4 | 🔴 Critical | No PageWrapper / page transitions | (missing file) |
| C5 | 🔴 Critical | Hardcoded hex colors | `Feedback.tsx`, `Patterns.tsx`, `Data.tsx`, `NotificationBell.tsx` |
| C6 | 🔴 Critical | 4 routes missing ProtectedRoute — auth bypass | `care-plans.tsx`, `emar.$residentId.tsx`, `tasks.handover.tsx`, `vitals.assessments.tsx` |
| H1 | 🟠 High | No layout component directory | (missing) |
| H2 | 🟠 High | Dashboard missing loading/error states | `routes/dashboard.tsx` |
| H3 | 🟠 High | Vitals uses raw useEffect for server data | `routes/vitals.tsx` |
| H4 | 🟠 High | 5 font weights (max 3 recommended) | `styles.css:1` |
| H5 | 🟠 High | No design-system/tokens TS directory | (missing) |
| H6 | 🟠 High | Hardcoded staff name "Wong KM" in WardTabletShell | `WardTabletShell.tsx:37` |
| H7 | 🟠 High | No branch selection context — `branches[0]` in 19 files | systemic |
| M1 | 🟡 Medium | Arbitrary `text-[0.8rem]` in shadcn components | `calendar.tsx`, `form.tsx` |
| M2 | 🟡 Medium | Missing standard CSS token aliases | `styles.css` |
| M3 | 🟡 Medium | No list virtualization | `residents.tsx`, `tasks.tsx` |
| M4 | 🟡 Medium | Dashboard task table + activity feed are mock data | `dashboard.tsx:39–100` |
| M5 | 🟡 Medium | Logo img missing explicit width (CLS risk) | `login.tsx:64` |
| L1 | 🟢 Low | Font subsetting not applied | `styles.css` |
| L2 | 🟢 Low | No skip-to-main-content link | shell components |
| L3 | 🟢 Low | Language toggle button missing aria-label | `AdminDesktopShell.tsx` |

---

## WHAT'S GOOD ✅

- Design tokens are comprehensive and well-structured in `styles.css` (CSS custom properties + `@theme inline`)
- All data hooks use TanStack React Query with caching (`staleTime: 60s`, `gcTime: 5min`) — no raw useEffect/setState data fetching (except vitals)
- Search inputs are debounced at 300ms (`residents.tsx:108–121`)
- Loading states (Skeleton rows) implemented on all major lists EXCEPT dashboard
- Error handling present on all mutations (toast.error)
- EmptyState components in use across all list views
- Single icon library (Lucide React) — consistent ✓
- Avatar, Badge, Skeleton, Modal/Dialog, Tooltip, Select all present in hms/ and ui/ ✓
- Supabase queries have proper pagination (range-based) ✓
- `scrollRestoration: true` on router ✓
- i18n (EN/ZH-HK) implemented ✓
