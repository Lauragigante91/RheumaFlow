---
name: Inferred dates never in date_value
description: Hard product rule on the raccordo timeline parser — back-computed/estimated dates must stay out of date_value; live in date_estimated instead.
---

# Inferred/estimated dates must never be written into `date_value`

Even when a start date is *derivable* (e.g. an explicit duration "per circa un anno" plus a dated stop in the same sentence makes the start year computable as stopYear-1), the parser must NOT put that computed value into `date_value`. The observed `date_value` stays null; the reconstructed year goes into the dedicated field `date_estimated`.

**Why:** The clinician's invariant is "nessun anno inventato" — a value in `date_value` must be one the text states, not one the parser reasoned out. Blurring observed vs reconstructed data was explicitly rejected. So estimates are allowed ONLY in a separate, explicit field that the UI/consumer can render as approximate.

**How to apply:** The duration back-inference feature is live (`inferred_by="duration_back_inference"`): a post-pass before dedup, gated on a dated `therapy_stop` whose source sentence matches `DURATION_ONE_YEAR_RE` AND has exactly ONE distinct drug, decorates the matching dateless `therapy_start` with `date_estimated=String(stopYear-1)`, `date_approximate=true`. `date_value` stays null. The guard test `RACC-START-NOSTOPDATE-1` still protects the invariant (start stays undated in `date_value`); `RACC-START-BACKINFER-1` covers the new `date_estimated`. Do NOT "fix" NOSTOPDATE-1 to assert a computed `date_value`. It is intentionally conservative (FN-leaning): if no dateless start already exists, the pass creates nothing.

**Related:** the stop `reason` may still fall back to a no-digit parenthetical "(motivo)" after the stop keyword (helper `extractParenReason`) — extracting a stated reason is fine; inventing a date is not.
