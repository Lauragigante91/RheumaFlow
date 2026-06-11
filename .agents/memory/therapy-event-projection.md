---
name: Therapy event projection
description: Therapy episode longitudinal fields are derived from events via one projection helper; guard rules for payload-driven event synthesis in update_therapy.
---

Therapy episode longitudinal fields (status, dose, frequency, route, end_date, discontinuation_reason) are DERIVED from therapy events, not written directly. `_therapy_event_projection(event)` maps an event type to the episode fields it implies; `_append_therapy_event_and_project(filter, event, extra_set)` is the ONLY place that writes longitudinal fields ($push event + $set projection). Any new write path that changes a longitudinal field MUST go through this helper, never a raw $set.

**Why:** the event ledger is the single source of truth that drives the patient timeline and point-in-time reconstruction (`_episode_state_at` / `_therapy_state_at` in helpers.py). A direct $set silently diverges the episode document from its own event history.

**Guard rule for update_therapy (PUT):** the frontend (TherapySection) re-sends the ENTIRE therapy object on every edit. A naive "field present in payload => changed" check synthesizes a spurious event on every metadata-only edit, and an empty end_date can force a discontinue. So update_therapy includes a longitudinal field in the synthesized event ONLY when its normalized value differs from the current DB doc, treating "" as None (`_norm`). Non-longitudinal fields go through a plain $set with no event.

**voided events:** the projection returns {} for events with `voided=True`. Note: `helpers._episode_state_at` does NOT yet skip voided events (out of scope), so point-in-time reconstruction would still apply a voided event — revisit if a void-event feature is ever wired up.

**Known residual limitations (not fixed; would need scope beyond the 2 files):**
- Editing only discontinuation_reason on an already-discontinued episode infers "discontinued" with event_date=today, overwriting the historical end_date and pushing a duplicate discontinued event. Fix idea: when the episode is already discontinued and only the reason changes, keep event_date = current end_date.
- Combined status->discontinued + dose change in one PUT: the dose lands only in the event (dose_after); the discontinued projection ignores it, so the episode-level dose stays stale.
- Clearing a longitudinal field with "" is detected as a change but the projection skips falsy *_after, so the clear no-ops on the episode field.
