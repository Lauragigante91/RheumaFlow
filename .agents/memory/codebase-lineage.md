---
name: Codebase lineage
description: Which branch is the canonical RheumaFlow codebase and how the monolith vs modular lines relate
---
The canonical, most complete codebase is the **modular** lineage preserved in branch
`backup-replit-current` (= remote `gitsafe-backup/main`, commit `e2ae392`): ~220-line
`backend/server.py`, 11 routers incl. `clinical_events.py`, `models.py`, full clinical
timeline (`ClinicalTimelineManager`), parser suite, disease profiles.

`origin/main` (GitHub `Lauragigante91/RheumaFlow`) was an **older monolithic** line
(`server.py` ~3463 lines) on a separate lineage. Features the user re-built on the
monolith (recall "selected"/shared_with visibility, dashboard "con me" badge, mobile
slide-in nav, therapy-event projection) were already present — and in better form — in
the modular backup. The backup's therapy projection even adds point-in-time
reconstruction (`get_therapy_state_at`).

**Why:** A `git reset --hard origin/main` once clobbered the modular work; the backup is
the recovery source. **How to apply:** treat the modular lineage as truth; don't
"port from" the monolith without checking the feature already exists in modular form.
