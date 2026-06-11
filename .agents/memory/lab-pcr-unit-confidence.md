---
name: PCR unit rule + confidence system
description: PCR defaultUnit=mg/dL (not mg/L), no implicit conversion, HIGH_RISK_KEYS trigger lab_review_items
---

## PCR/CRP unit rule (RheumaFlow local lab)

**Rule**: if unit not specified → mg/dL (local lab reports in mg/dL).
- `defaultUnit: "mg/dL"` (was mg/L)
- `normalize()` removed entirely — no implicit mg/dL→mg/L conversion
- `referenceHighByUnit: { "mg/dL": 0.5, "mg/L": 5 }` — inferStatus is unit-aware
- `inferStatus(param, value, detectedRange, unit)` now accepts 4th arg

**Why**: different labs report CRP in different units; implicit conversion corrupts data; storing value+unit as-is is safer.

## Confidence system

`HIGH_RISK_KEYS` in labValueExtractor.js: `crp, ves, creatinina, hb, wbc, plt, alt, ast, proteinuria`

For these params: `inferred_unit=true` → `confidence="low"` + `review_reason` string.

In `visitTextParser.js`:
- Low-confidence items → `lab_review_items[]` (NOT in lab_exams, NOT auto-saved)
- High-confidence items → `lab_exams[]` as usual

`lab_review_items` shape per item:
```
{ key, label, panel, date, proposed_value, proposed_unit, inferred_unit,
  qualitative, status, source_text, review_reason }
```

## UI

`LabValueReviewPanel.jsx` — shows per-item: source_text, review_reason, actions.
Actions: "Conferma valore proposto" / "Inserisci manualmente" (inline form) / "Ignora".
Confirm moves item to lab_exams; ignore discards.

Wired in:
- `VisitImportButton.jsx` → `buildEditableDraft` stamps `lab_review_items`
- `WizardVisitStep` → Section D
- `ExtractedReview` → `lab_review_items` section in sidebar

**How to apply**: any future HIGH_RISK param with absent unit will be flagged automatically. To add a new high-risk param, add its key to `HIGH_RISK_KEYS`.
