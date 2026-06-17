---
name: Import path unification
description: Storico "Importa da testo" unified to VisitImportButton; applyOneDraft get-or-create workup by date; groupSidebarVisits pure helper for visual merge
---

# Import Path Unification

## Routing change
The storico "Importa da testo" button (in the Storico valutazioni dialog in PatientDetail) previously opened `ImportVisitFromTextModal`. It now opens `VisitImportButton` (`setImportTextOpen(true)`) — the same advanced importer used by the main import path. `ImportVisitFromTextModal` is retired from this flow (still on disk, used elsewhere).

**Why:** Two separate import paths meant one date could produce two separate sidebar cards — one from the workup_visit and one from the orphan assessment created by the simpler modal.

## applyOneDraft get-or-create (una data = una visita)
In `applyOneDraft` (`frontend/src/lib/importApply.js`), the `wantVisitSections` block now calls `workupVisitsApi.list(patient.id)` first, finds an existing workup_visit matching the same date+type, and if found:
- PATCHes only fields where `isEmptyVal(existing[field])` — never overwrites populated fields
- Links assessments to the existing visit id

If not found, creates as before.

**Why:** Prevent duplicate workup_visit cards when the same patient date is imported twice from different flows.

## groupSidebarVisits — pure helper
`frontend/src/lib/visitGrouping.js` extracts the sidebar visit grouping logic from PatientDetail's inline useMemo. Orphan assessments (no visit_id) whose date matches a workup_visit date are attached to that workup card's `linkedAssessments` (display-only, non-destructive — no DB migration).

**Why:** Pure function is testable; display merge keeps the invariant "one date = one card" without requiring a migration of orphan assessment documents.

**How to apply:** `PatientDetail.jsx` uses `useMemo(() => groupSidebarVisits({...}), deps)`. New fields on workup card items: `linkedAssessments[]` (assessments by visit_id OR orphan on same date).

## therapy_start → clinical_events bridge (already present)
`applyOneDraft` already generates `therapy_start` events for `t.status === "active" && t._action === "new_episode"` therapies via `buildTherapyStartEvent`, deduplicating against raccordo_events, in a single `clinicalEventsApi.batchCreate` call. Tests: L432 and L592 in `importApply.test.js`.
