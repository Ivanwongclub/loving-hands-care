## Goal
Seed `emar_records` so the eMAR overview and schedule views have realistic data for today (2026-06-04) and the previous 5 days (2026-05-30 → 2026-06-03).

## Source orders
Four ACTIVE scheduled medication orders (PRN excluded — those are created on-demand):

| Order | Resident | Times/day |
|---|---|---|
| Furosemide 40mg | 陳大文 | 08:00 |
| Metformin 500mg | 陳大文 | 08:00, 18:00 |
| Donepezil 10mg | 林志傑 | 20:00 |
| Amlodipine 5mg | 黃美玲 | 08:00 |

Total slots: 5 doses/day × 6 days = **30 records**.

## Status distribution (realistic)
For each `due_at`:
- **Past days (May 30 – Jun 3)** → `ADMINISTERED` with `administered_at` ≈ due_at + 5–15 min, `administered_by` = a NURSE staff id, `barcode_verified=true`, `shift_pin_verified=true`. One slot per day randomly marked `REFUSED` (with `refusal_reason`) or `HELD` (with `hold_reason`) to show variety — total ~2 refused, ~1 held over 5 days.
- **Today (Jun 4)** → mix based on current time: morning 08:00 doses `ADMINISTERED`, 18:00/20:00 doses `DUE` so the "due now / upcoming" cards have content.

## Execution
Single `INSERT` via the data tool into `public.emar_records` with explicit UUIDs (`80000000-…`) so the seed is idempotent (re-run = upsert via ON CONFLICT DO NOTHING on id).

## Out of scope
- PRN order records (created interactively in the app).
- Backfilling residents/orders/staff — already seeded.
- Touching `medication_orders.start_date` (some start after May 30; those days' records will just be skipped to stay schema-valid).

Confirm and I'll run the insert.