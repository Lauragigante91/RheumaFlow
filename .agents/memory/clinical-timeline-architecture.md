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
