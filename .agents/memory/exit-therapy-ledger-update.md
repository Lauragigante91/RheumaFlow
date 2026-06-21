---
name: Exit therapy text → ledger update
description: Pattern for parsing exit_therapy_text (§10) to update the therapy ledger on follow-up visit save.
---

## The rule

`parseExitTherapyChanges(text, today)` (exported from visitTextParser.js) wraps `extractTherapies(text, today, "ind")` and returns only therapies where:
- `category ∈ _RHEUM_CATEGORIES_SET`
- `status === "active"`
- `_visit_event === "change"` (verb "aumenta/riduce/modifica" detected before drug name)
- `dose != null || frequency != null`

`TodayVisitSection.save()` calls it after the workup_visit is saved, then fans out `therapiesApi.upsert()` via `Promise.allSettled` (errors are non-blocking).

**Why:** exit_therapy_text was saved to workup_visit but the therapy ledger was never updated from manual doctor input ("aumenta Cosentyx a 300mg"). The backend standard upsert pathway already compares dose vs active episode and generates dose_increased/dose_reduced events — no event_type_override needed.

**How to apply:**
- No client-side dose comparison needed — the backend does the diff.
- `Promise.allSettled` ensures a single upsert failure doesn't abort the whole save.
- `_visit_event === "change"` guard means "continua MTX 15mg" (no verb) is not incorrectly treated as a dose change.
- RHEUM_CATEGORIES filter avoids polluting the ledger with non-rheumatological drugs from exit text.
- The `dose` field format from the parser is "300mg" (no space) — `_extract_dose_mg` on the backend accepts both.
