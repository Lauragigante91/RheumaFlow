---
name: Visit date extraction — RE priority
description: extractVisitDate uses 4-tier regex cascade; "del" removed from keyword list to prevent false matches on historical exam dates.
---

# Visit date extraction priority cascade

`extractVisitDate()` in `frontend/src/lib/visitTextParser.js`.

## Rule
RE0 (highest) → RE1 → RE2 → RE3 (last resort).

- **RE0** — refertazione/firma formulas: `data.*refertazione`, `data referto`, `data.*emissione`, `firmato digitalmente`. Catches "Data e ora di refertazione: 02/12/2025" typical in AUSL Bologna referti.
- **RE1** — contextual keywords: `visita`, `in data`, `effettuata`. **"del" was removed** — it's a generic Italian preposition that matches "rx bacino del 07/08/2020" (historical exams) before the real visit date.
- **RE2** — bare date fallback: scans ALL bare dates, returns first with year ≥ currentYear-1.
- **RE3** — last resort: returns very first valid bare date (handles old follow-up letters with no recent date).

**Why:** TS01 PDF had "del 07/08/2020" (in ACCERTAMENTI section) appearing before "Data e ora di refertazione: 02/12/2025" → parser returned 2020-08-07 instead of 2025-12-02.

**How to apply:** Any time a new letter format shows wrong visit dates, check which RE matched first. Add new RE0-level patterns for institution-specific refertation headers.
