---
name: Raccordo events dedup in reconcileDrafts
description: Architectural rules for deduplicating clinical_events across multi-import, OCR variants, and single batchCreate per batch.
---

# Durable rules for clinical_events deduplication

## 1. Every draft array type needs a dedup block

The patient's anamnestic history is restated in every letter. The multi-import
reconciler is the single choke point for "save once": it must mark existing-in-DB
and seen-in-batch items as duplicate+skip. When a new draft array type is wired in
but NOT given a dedup block, importing N PDFs silently writes every item N times.
Single-import bypasses the reconciler, so this class of bug is multi-import-only.

**Why:** there is no server-side identity dedup on batch create; the client
reconciler is the only early-stage guard.

## 2. Any field in a dedup/identity key MUST be persisted server-side

If the backend model omits an identity field, Pydantic drops it on save. In-batch
dedup still works (both drafts carry it), but on **re-import** the stored copy keys
with an empty field while the fresh parse keys with the value → no match →
duplicate. The fix: declare the field on the backend event model so it round-trips.

**How to apply:** when extending a client identity key, check the backend model
first — a non-persisted key field degrades cross-session dedup silently.

## 3. `diagnosis` / `disease_status` dedup must ignore the detail text (Fix 1)

Two diagnosis events for the same year from different letters will have slightly
different raw sentence text (OCR/encoding variants: e.g. "sieronegativa2" vs
"sieronegativa¿"). The `normTextSig` pipeline cannot bridge this gap because
digits (like "2") survive normalization while non-alphanumeric OCR artifacts
(like U+00BF "¿") are stripped, producing different sorted word bags.

**Rule:** for `event_type` in `{"diagnosis", "disease_status"}`, both the
frontend `eventKey` (visitReconciler.js) and the backend `_clinical_event_sig`
(clinical_events.py) must set `text = ""` — the discriminating key is
`(event_type, year)` only. `disease_onset`, `therapy_start`, and all other types
still use the full text in the sig.

**Why:** a patient can have at most one diagnosis event per year for the same
disease; the exact wording is OCR-unstable and clinically irrelevant for identity.
`disease_onset` is intentionally kept text-sensitive because "artrite alle mani"
and "artrite ai piedi" are genuinely different events in the same year.

**Known tradeoff / future work:** collapsing on (event_type, year) also collapses
two *different* diagnoses in the same year (e.g. AR + PsA, both diagnosed in 2000).
This is acceptable in the short term because co-incident diagnoses in the same year
are rare and the alternative (text-based dedup) produces far more OCR duplicates.
Future fix: introduce `diagnosis_canonical` (normalised ICD or free-text
canonicalized disease name) as a third key component, making the sig
(event_type, year, diagnosis_canonical). Do not add this until the canonical
field is reliably parsed and stored — adding an un-populated field only shifts
the problem.

**Where:** `EVENT_TYPES_NO_TEXT_SIG` Set in visitReconciler.js; `_NO_TEXT_SIG_TYPES`
set in backend/routers/clinical_events.py.

## 4. `applyDraftBatch` fires ONE final `batchCreate` for all raccordo events (Fix 2)

Before: each per-draft `applyOneDraft` fired its own `batchCreate` for its
raccordo events. Result: N calls per N drafts. Backend dedup re-fetches DB each
call, so identical-sig events were filtered — BUT OCR-variant events (same
diagnosis, different text) survived because their sigs differed.

**Rule:** `applyDraftBatch` calls each `applyOneDraft` with
`{ skipPatientState: true, skipEventBatch: true }`. Each returns
`pendingEvents` (raccordo_events + therapyStartEvents, each stamped with its
`visit_id`). `applyDraftBatch` accumulates all events and fires ONE final
`batchCreate` after the loop. The backend dedup handles cross-draft collisions
in a single pass.

**Why:** fewer round-trips, simpler reasoning, and cross-draft dedup (with Fix 1
making diagnosis sigs stable) is now fully effective in one backend call.

**Note:** the single-draft import flow (`applyOneDraft` called directly from the
UI without `skipEventBatch`) is unchanged — it still fires its own batchCreate
immediately after the therapy/raccordo processing.
