---
name: Therapy point-in-time reconstruction
description: therapy_state_at() algorithm, extended TherapyEvent model, new endpoint — for historical dose/frequency/route reconstruction.
---

## What was built

**Endpoint:** `GET /patients/{patient_id}/therapies/state?date=YYYY-MM-DD`
Returns active therapies at any past date with historically-accurate dose, frequency, route.

**Why:** `_therapies_active_on()` (export.py) returned current dose for historical queries — wrong when doses changed. The new algorithm walks `events[]` to reconstruct the correct values.

## TherapyEvent new fields (additive, no migration needed)
- `frequency_before`, `frequency_after` — carried on `dose_increased/reduced` and `regimen_changed`
- `route_before`, `route_after` — same
- `date_approximate` — on event level (separate from episode-level)
- `started` / `noted` events now carry `frequency_after` / `route_after` to bootstrap reconstruction

## New event type: `regimen_changed`
Semantics: any change to the therapeutic regimen (frequency, route) WITHOUT a dose change.
Includes: spacing, route switch (im→sc), interval adjustments.
NOT a synonym for "spacing" — covers all non-dose regimen changes.

## Algorithm: _episode_state_at(episode, target_date)

**Phase 1 — Eligibility:**
- No start_date ("noted"): include at all dates until end_date → status="active_noted"
- start_date > target_date: SKIP
- end_date < target_date: SKIP
- Otherwise: status="active" or "active_approximate"

**Phase 2 — Walk events (sorted by date):**
1. Bootstrap from founding event (started/noted/historical_exposure): sets initial dose, frequency, route
2. Apply changes forward up to target_date:
   - dose_increased/dose_reduced: apply dose_after, frequency_after, route_after (if present)
   - regimen_changed: apply frequency_after, route_after
   - continued/paused/discontinued: no field changes
3. Fallback: episode-level dose/frequency/route (= current/latest value) used if events lack extended fields

## Key design decisions

**Why:** `episode.dose` = current dose, not historical. Without event walk, historical queries are wrong.

**started/noted events must carry frequency_after/route_after** — this is the bootstrap for reconstruction. If missing (old data), falls back to episode.frequency/route (= current value, accurate only if never changed).

**"noted" with null start_date** → conservative: include at ALL dates until end_date. Clinician saw drug active at first contact; exact start unknown. Mark as "active_noted" so callers know.

**export.py:** _therapies_active_on() now delegates to _episode_state_at(). Same algorithm duplicated (no shared module) — export.py is self-contained by design.

**POST /therapies (simple):** does NOT auto-create events. Only upsert does. For test data seeding, manually POST /therapies/{id}/events with type="started" + frequency_after + route_after.

## Adalimumab case study — verified 5/5

| Date | Atteso | Risultato |
|------|--------|-----------|
| 2010-06-01 | Adalimumab 40mg ogni 2 sett. | ✅ active_approximate |
| 2017-06-01 | (gap — nessuno) | ✅ vuoto |
| 2021-06-01 | Biosimilare 40mg ogni 2 sett. | ✅ active_approximate |
| 2023-06-01 | Biosimilare 40mg ogni 4 sett. | ✅ active_approximate |
| 2026-01-01 | Biosimilare 40mg ogni 6 sett. | ✅ active_approximate |
