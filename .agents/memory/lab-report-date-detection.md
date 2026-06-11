---
name: Lab report date detection
description: How the real lab report date is derived (detectReportDate) and the never-invent-a-date rule across all import paths.
---

`detectReportDate(text)` in labValueExtractor.js returns `{date, displayDate, source}` or null. It matches ONLY explicit labeled date patterns, ranked: prelievo/esecuzione/prelevato (1) > accettazione (2) > esami del / del / in data (3) > referto (4) > stampa/emissione (5). Lowest rank wins; no label → null.

**Why:** the old behavior forced the current/visit date onto undated lab reports, fabricating clinical dates. A stamped/printed date (`stampa`) is almost never the draw date, so it must lose to `prelievo`. Inventing a date corrupts the longitudinal chart, so absence must stay null.

**How to apply:**
- Date never falls back to today/visit-date. If no explicit date: leave null and let the doctor confirm (UI uses a `window.confirm` "salva senza data").
- Backend `upsert_lab_exam` skips the merge lookup when `date is None` (guard `if payload.date else None`): undated records always insert, never merge into each other. `LabExamBase.date` is `Optional[str]=None`. Null dates sort last.
- Three import paths must stay consistent: PATH A (visitTextParser/buildLabExamPayload), PATH B (LabImportFromImageDialog OCR/PDF), and LabImportDialog (parseLocalLabText). All use detectReportDate, none default to today.
- PATH A applies detectReportDate(labScope) ONLY when there is exactly ONE undated group (single-report case); with multiple/inline-dated groups it does NOT guess, leaving null.
- Referto narrative (buildLabText) groups ALL params of one document/date into ONE sentence: "Esami di laboratorio del gg/mm/aaaa: ..." (or "Esami di laboratorio: ..." when undated), never split per panel.
