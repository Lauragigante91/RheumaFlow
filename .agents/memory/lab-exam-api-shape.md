---
name: Lab exam API shape mismatch
description: Backend LabExamBase model fields differ from frontend internal representation; apply() must convert.
---

## The rule

Backend `LabExamBase` (models.py) requires:
- `panel: str` — **required**, no default (e.g. "fase_acuta", "emocromo", "custom")
- `values: Dict[str, Any]` — dict keyed by normalized test name (e.g. `{"ves": {value:"32",unit:"mm/h"}}`)

The `visitTextParser.js` `groupLabValuesToExams` returns frontend-internal format:
- `panel: str` — original panel key (added after fix)
- `category: str` — mapped human label (e.g. "ematochimici")
- `results: Array<{name, value, unit, qualitative, status}>` — array of result objects

**Why:** `LabExamBase` was designed around the `LabImportDialog` workflow which uses a `panels` dict structure, not the array-of-results format the text parser uses.

**How to apply:** In `VisitImportButton.apply()`, always convert `results` array → `values` dict before calling `labExamsApi.create()`. Key normalization: `name.toLowerCase().replace(/[\s\-/]+/g, "_").replace(/[^a-z0-9_]/g, "")`. Use `ex.panel || ex.category || "custom"` for the `panel` field.
