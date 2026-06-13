---
name: Onset sentence must not swallow an explicit therapy_start; spacing accepts "ogni"
description: Two recovered TPs in the raccordo parser whose enabling rules are easy to break again.
---

# Onset / start co-occurrence + dose_spacing "ogni"

Two true positives were lost and recovered; both rules are fragile and worth guarding.

## Rule 1 — onset branch must fall through to therapy_start when a start verb co-occurs
An onset sentence (disease_onset) that ALSO contains an explicit start/add verb
(aggiunto/introdotto/avviato) + an explicit date + at least one non-ancillary drug
must still emit therapy_start, while keeping disease_onset. The onset branch must
NOT `continue` unconditionally — it has to let such sentences reach Rule 2/2b.

**Why:** real case "Nel 2017 esordio nefrite, aggiunto Micofenolato Mofetil 2g/die"
silently dropped the MMF start because the onset branch swallowed the whole sentence.

**How to apply:** keep the gate conservative (verb AND date AND non-ancillary drug);
bare onset with no start verb must produce only disease_onset, never therapy_start.
Residual non-blocking risk: two explicit years in one sentence (onset year vs start
year) could let the wrong year attach — add a co-reference guard if that surfaces.

## Rule 2 — dose_spacing phrasing includes optional "ogni"
"spacing a ogni N settimane" must match the same as "spacing a N settimane". The
strong `spacing` anchor stays; only an optional `ogni` before the week count was added.

**Why:** real case "Nel 2024 spacing a ogni 8 settimane" produced no dose_spacing.

**How to apply:** dose_spacing IS scored as a therapy type by the audit, so a miss
is a real FN; do not drop the `spacing` anchor when touching this regex.
