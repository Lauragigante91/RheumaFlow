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
**Rule:** import must bridge a genuinely-new active start into `clinical_events` as a synthetic `therapy_start`. Discriminator: `status === "active" && (t._action === "new_episode" || !t._action) && !_skip`. The `!t._action` branch covers **single-visit imports** (no reconciler run), where the parser leaves `_action` undefined on all active therapies. Explicit `_action` values (dose_change/regimen_change/discontinue) exclude FP; continued has `_skip:true` so it is filtered upstream.
**Why:** the reconciler sets `_action:"new_episode"` only for multi-visit/reconciled flows. Single-visit imports (paste-text or single PDF — the most common user path) never went through reconcileDrafts, so `_action` was always undefined → condition `=== "new_episode"` always failed → timeline always empty for single-visit starts.
**How to apply:** push event only after a successful `therapiesApi.upsert`; merge with confirmed `raccordo_events` into ONE `clinicalEventsApi.batchCreate`. Frontend dedup skips synthetic when raccordo already has a `therapy_start` for the same normalized drug. Backend `_clinical_event_sig` still deduplicates vs existing events and within-batch.
