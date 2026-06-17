---
name: Clinical timeline architecture
description: ClinicalTimelineManager replaces static ClinicalTimeline; timeline is a canonical domain entity with full CRUD
---

## Rule
The clinical timeline is a canonical domain entity, not a parser output.
`ClinicalTimelineManager` is a smart component that fetches its own data and owns all CRUD operations.
`ClinicalTimeline.jsx` (legacy read-only component) is still in the codebase but is no longer mounted anywhere in the main app.

## Data model additions (ClinicalEventBase)
- `titolo: Optional[str]` — free-text human-readable title
- `categoria: Optional[str]` — "malattia"|"terapia"|"esame"|"ricovero"|"procedura"|"diagnosi"|"altro"
- `source_origin: Optional[str]` — "inserimento_manuale"|"import_testo"|"import_pdf"|"generato_da_parser"|"modifica_manuale"
- `updated_by / updated_at` — stamped by PATCH endpoint automatically

## Why
The user needs to add events from historical documents (e.g., 2007 letter brought in 2026) without reimporting full history. The timeline must persist and be editable independently of imports.

## How to apply
- `ClinicalTimelineManager` mounts in the "Storico valutazioni" dialog in PatientDetail with `patientId` prop only
- Manual creates: default `source_origin = "inserimento_manuale"`; batch import: `source_origin = "generato_da_parser"`
- Merge: keep one event (PATCH with merged detail), soft-delete the other (DELETE endpoint)
- `categoria` is auto-derived from `event_type` via `CATEGORIA_FROM_TYPE` dict; explicit field overrides derivation

## Import start → timeline bridge
Saving a therapy episode on import writes a `started` event INSIDE the `db.therapies` doc; the timeline renders ONLY `db.clinical_events`. So an "IN TERAPIA:"/current-visit biologic start saved the episode but left the timeline empty.
**Rule:** import must bridge a genuinely-new active start into `clinical_events` as a synthetic `therapy_start`. Discriminator is reconciler semantics — `status === "active" && _action === "new_episode" && !_skip` — NOT parser text heuristics; this excludes continued/dose_change/regimen_change/discontinue and historical exposures (status discontinued).
**Why:** keeps FP=0 (no events for labs/RM/exams/follow-ups) without fragile NLP; reuses the contract the reconciler already computes.
**How to apply:** the synthetic event is pushed only after a successful `therapiesApi.upsert` (no orphan events for failed saves), and merged with confirmed `raccordo_events` into a SINGLE `clinicalEventsApi.batchCreate`. Frontend dedup skips the synthetic when a confirmed raccordo `therapy_start` exists for the same normalized drug; backend `_clinical_event_sig` still dedups vs existing + within-batch. Regimen lives in `detail` (`[dose,route,frequency].join(" ")`), which the backend signature includes — safe because re-import duplication is prevented upstream by reconciler continuity.
