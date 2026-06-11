---
name: Multi-date lab import architecture
description: How the multi-date lab grouping works in ImportVisitFromTextModal, and key design constraints to maintain.
---

## Where it lives
- Parser: `frontend/src/lib/labValueExtractor.js` → `extractLabValuesByDate(text)`
- UI: `frontend/src/components/ImportVisitFromTextModal.jsx`
- Entry point: PatientDetail → Storico valutazioni → "Importa da testo" (only here; VisitImportButton uses a separate parser with no multi-date support)

## DATE_HEADER_RE regex — key constraint
The regex uses three mutually exclusive prefix alternatives to avoid false positives from clinical sentences like "Visita del paziente risalente al 15/03/2024":

1. Explicit Italian phrases: `esami\s+(?:ematici\s+)?del\s+|prelievo\s+del\s+|...|del\s+|in\s+data\s+|data[=:\s]+`
2. Short abbreviation + non-space separator (≤8 chars + `=`/`:`/`-`): `[A-Za-z]{1,8}[=:\-]+[ \t]*`
3. Very short abbreviation + space (≤6 chars): `[A-Za-z]{1,6}[ \t]+`

**Why:** Allowing multi-word generic prefixes (e.g. `[A-Za-z]+(?:[ \t]+[A-Za-z]+)*`) causes clinical sentences to be parsed as date headers. The 6-char limit on plain-space abbreviations ensures "Visita " (6 chars + space) still fails because "del" follows instead of a digit.

## Supported input formats
- `- EE 11/11/2025: Hb 15, WBC 5`  (bullet + abbrev + space + date + colon)
- `EE= 15/03/2024: VES 45`          (abbrev + = + date)
- `Esami del 15/03/2024`            (Italian phrase)
- `del 15/03/2024`                  (short phrase)
- `15/03/2024`                      (date alone)

## Lab catalog aliases added
- Neutrofili: added `\\bN\\b` (used as "N 4" in clinical shorthand)
- Linfociti: added `\\bLy\\b` (used as "Ly 2" in clinical shorthand)

## JSX pattern
`showGroupedLabs` and `renderLabRow` are defined in the component body (before `if (!open) return null`), NOT inside JSX as an IIFE — CRA has issues with `(() => {...})()` inside JSX.

**Why:** IIFE pattern inside CRA JSX can cause silent render failures.
