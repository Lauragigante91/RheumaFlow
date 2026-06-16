---
name: Multi-import per-visit vs longitudinal split
description: How multi-PDF visit import separates per-visit writes (N times) from patient-level state (once, latest-wins)
---

In `importApply.js`, multi-PDF import is two-phase via `applyDraftBatch(toApply, patient, opts)`:
- **Phase 1 (per-visit, N times):** loops `applyOneDraft(..., { skipPatientState: true })` per draft. `skipPatientState` gates the 4 patient-level write blocks (patient diagnosi+anagrafica, profilo_generale, comorbidita, intolleranze). Everything else (workup_visit, assessments, therapies, labs, instrumental, exam_imaging, disease profiles, raccordo_events) still runs per draft so every visit is fully reconstructable/openable.
- **Phase 2 (longitudinal, once):** `applyLongitudinalState(draftsAsc, patient)` writes patient state once. `computeLongitudinalState` resolves **latest-non-empty per field** (input MUST be sorted ascending by date; the newest non-empty overwrites). Anti-empty guard + skip-if-same: only writes a field if computed value is truthy AND differs from current patient value. Anagrafica+diagnosi via `patientsApi.update` (PUT); profile fields (anamnesi_fisiologica/familiare, terapia_domiciliare, comorbidita_apr, allergie_testo) via `patientsApi.patch` (PATCH).

**Why:** importing 9 PDFs previously appended diagnosi/anamnesi N times (concatenation) because `applyOneDraft` did both per-visit and patient-state writes inside the multi loop. The current profile must reflect the LATEST visit, not a concatenation of all letters.

**How to apply:**
- `applyDraftBatch` assumes ascending-date input; its only caller (`VisitImportButton.applyMulti`) sorts ascending before calling. Preserve that contract for any new caller.
- No inter-draft patient refetch is needed in phase 1 (it no longer mutates patient state); disease profiles fetch their own latest via `diseaseProfileApi.get`.
- comorbidita_apr/allergie_testo precedence per draft: structured items (selected.comorbidita/intolleranze) win; else profilo_generale fallback (comorbidita_apr / allergie).
- **Single import (`apply`, applyOneDraft default no-skip) intentionally stays append-merge (`mergeFreeTextConservative`)** — P1 changed multi only; changing single-import to overwrite is a separate decision (risk: clobbering manually-entered data on a routine one-letter import).
- Disease profiles (ra/spa/sle/sclero) deliberately stay per-draft (fill-empty-only, never concatenates) — out of the longitudinal-once scope.
