---
name: FirstVisit save merge guard
description: Why FirstVisitPage save must omit (not empty-write) structured fields to avoid silently wiping DB data.
---

# FirstVisitPage save — preserve structured data via per-key merge

**Rule:** the disease-profile upsert (`PUT /patients/{id}/disease-profile/{type}`) is a
**per-key `$set` merge** on the inner `data` object (`set_ops = {f"data.{k}": v for k,v in payload.data.items()}`),
NOT a full replace. Therefore: a key absent from the payload's `data` is left untouched in Mongo;
a key present with an empty value (e.g. `comorbidities: {}`) OVERWRITES and wipes the stored value.

When saving a structured field that is derived from a transient in-session action (e.g.
`comorbidities` derived only from a fresh `analyzeComorbidityText` run), guard it:
write the field ONLY when the action produced it this session; otherwise delete the key
from the payload so the merge preserves the DB value. Free text stays the primary source
and is always written; structured groupings are derived and must never be zeroed without
explicit user action.

**Why:** FirstVisitPage `goNext()` calls `save(true)` on EVERY step transition, and
`load()` seeds `data.comorbidities` from the saved profile. Before the guard, navigating
"Avanti" (or re-saving) without re-running the analysis sent `comorbidities: {}` and
silently erased previously-saved structured comorbidities in the referto grouping. The
user explicitly rejected this as unacceptable for a clinical app.

**How to apply:** for any FirstVisitPage payload field that has an empty default
(`{}`/`[]`/`null` in EMPTY_DATA) and is only populated by a transient action, build the
profile payload conditionally — set it when the action ran, `delete` the key otherwise.
Conditions saved via `conditionsApi.upsert` are append/update-only and are not at risk.
