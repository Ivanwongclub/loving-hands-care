## Fix: eMAR 總覽 stuck on "loading"

### Root cause
`src/routes/emar.tsx` derives `branchId` from `staff.branch_ids[0]`. The signed-in user (Demo Admin, SYSTEM_ADMIN) has `branch_ids: []` in the DB, so `branchId` is `null` forever and the page renders an `EmptyState` whose title is literally `common.loading`.

### Change
Edit only `src/routes/emar.tsx` — `EMARDashboardPage` (lines 67–86):

- Replace `const branchId = staff?.branch_ids?.[0] ?? null` with `const branchId = branches[0]?.id ?? null`, sourced from the existing `useBranches()` hook (which already handles the SYSTEM_ADMIN "all active branches" fallback).
- Track `staffLoading` and `branchesLoading` to distinguish a real loading window from a misconfigured account.
- When not loading and still no branch, show a clear "No branch assigned — contact administrator" message instead of the perpetual "Loading…" string.

`DashboardBody` and all other logic remain untouched.

### Out of scope
- Backfilling Demo Admin's `branch_ids` in seed data.
- Auditing other routes that may have the same pattern (none of the routes I checked do; they already use `useBranches()`).
- Adding a branch picker for multi-branch SYSTEM_ADMINs (separate feature).

### Verification
- Reload `/emar` as Demo Admin → page renders the dashboard against the first active branch instead of "loading".
- Reload as a user with a populated `staff.branch_ids` → behavior unchanged.
- Temporarily simulate a user with no accessible branches → message reads "No branch assigned…" instead of "Loading…".
