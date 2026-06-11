---
name: Therapy regime-change persistence path
description: Why frequency/route/formulation changes need the full upsert payload, not the continuity payload
---

In the multi-visit import apply path, a reconciled therapy item is persisted
two different ways depending on its flags:

- `_skip:false` -> upserted via `buildTherapyUpsertPayload` (carries
  dose + frequency + route + status). The backend /therapies/upsert detects a
  freq/route change on an active episode (same mg) and appends a
  `regimen_changed` event + $sets the new values -- no episode fragmentation.
- `_skip:true && _call_upsert:true` (continuity) -> `buildTherapyContinuityPayload`
  carries **dose only**. Frequency/route/formulation changes are silently lost
  here.

**Rule:** any therapy change beyond mg dose (frequency, route, formulation,
non-mg dose text) must be classified so it ends up with `_skip:false`
(reconciler sets _action "regimen_change", _status CONFLICT) -- otherwise the
new regime never reaches the DB.

**Why:** the continuity payload was designed only to confirm a continued drug,
so it omits freq/route by construction.

**How to apply:** when editing visitReconciler.js comparison logic, keep the
comparison conservative (both values non-null AND differ) to avoid false
conflicts on legacy docs that lack frequency/route, but never route a real
regime change through the continuity branch.
