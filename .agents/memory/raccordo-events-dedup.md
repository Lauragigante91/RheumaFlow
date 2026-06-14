---
name: Raccordo events dedup in reconcileDrafts
description: Why timeline (clinical) events must be deduplicated in the multi-import reconciler, and the date_estimated DB-dedup limitation.
---

# reconcileDrafts must dedup raccordo_events (timeline), not only therapies/assessments/labs

reconcileDrafts (frontend/src/lib/visitReconciler.js) annotates each draft array
with a status and skips duplicates across the batch and against existing DB data.
It originally handled `therapies`, `assessments`, `lab_exams` only — `raccordo_events`
(the longitudinal timeline / clinical_events) was passed through untouched.

**Bug:** the patient's anamnestic history (esordio, remissione, stop/start) is
restated in *every* letter's "raccordo" section, so importing N PDFs created every
timeline event N times (identical date/type/text). Single-import does NOT call
reconcileDrafts (apply → _applyOneDraft once) so it saves events once — the dup bug
was multi-mode only. Backend batch_create does no server-side dedup.

**Rule:** any new draft array type added to the import pipeline MUST get a matching
dedup block in reconcileDrafts (existing-in-DB → DUPLICATE+_skip; seen-in-batch →
DUPLICATE+_skip; else NEW), AND be counted in draftSummaryStats toSave/skipped, AND
have its existing-DB source fetched in VisitImportButton.parseMulti and passed via
existingData. _applyOneDraft already filters `!e._skip`, so setting _skip prevents save.

**Why:** the reconciler is the single choke point for "save once". Missing a type
there silently duplicates on every multi-letter import.

**date_estimated DB-dedup limitation:** the dedup key is
`event_type::normDate(date_value||date_estimated)::drug(canonical||to||from)::text(manifestation||detail)`.
Cross-batch dedup works for ALL events (both parser drafts carry date_estimated).
But model ClinicalEventBase has NO date_estimated field (extra="ignore" drops it),
so estimated-only events persist with date_value=null. Re-importing the same letter
later can therefore re-create an estimated-date event (its DB copy keys with empty
date, the fresh parse keys with the estimate → no match). All reported dups had real
date_value, so this is an accepted edge case unless date_estimated is persisted or
normalized into date_value before save.
