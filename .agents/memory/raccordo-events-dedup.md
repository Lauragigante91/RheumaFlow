---
name: Raccordo events dedup in reconcileDrafts
description: Why timeline (clinical) events must be deduplicated in the multi-import reconciler, and why every dedup-key field must be persisted by the backend model.
---

# Two durable lessons from the multi-PDF timeline-duplication bug

## 1. Every draft array type added to the import pipeline needs a dedup block

The patient's anamnestic history (esordio, remissione, stop/start) is restated in
*every* letter's "raccordo" section. The multi-import reconciler is the single
choke point for "save once": it must mark existing-in-DB and seen-in-batch items
as duplicate+skip. When a new draft array type is wired in but NOT given a dedup
block there (and a fetch of its existing DB rows + a slot in the save counters),
importing N PDFs silently writes every item N times. Single-import bypasses the
reconciler, so this class of bug is multi-import-only and easy to miss.

**Why:** there is no server-side dedup on batch create; the client reconciler is
the only guard.

## 2. Any field used in a client dedup/identity key MUST be persisted server-side

The event identity key mixes a date that can come from an *estimated* field, not
just the declared date (back-inferred years live in a separate "estimated" field;
the declared date stays null — estimated dates must never pollute the official
date; see raccordo-inferred-dates-never-in-datevalue.md).

If the backend model omits that estimated field, Pydantic drops it on save. In-batch
dedup still works (both drafts carry it), but on **re-import** the stored copy keys
with an empty date while the fresh parse keys with the estimate → no match →
duplicate. The fix was to declare the field on the event model so it round-trips.

**Why / how to apply:** when you extend a client identity key, check the backend
model first — a key field that is not persisted degrades cross-session dedup
silently, and only re-import (not first import) exposes it.
