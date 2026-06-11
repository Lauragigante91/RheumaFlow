---
name: Phase 5 data model stabilization
description: 4 conservative, retrocompatible changes to data model — key fixes, new optional fields, canonical lab key map.
---

## Changes applied

### 1. SSc antibody key fix (visitTextParser.js)
`extractScleroProfile()` now uses `aca` and `rnap3` (matching ScleroProfileSection form field names).
Previously used `centromere` and `rna_pol3` → data was parsed but never matched form fields.

### 2. `indication` on TherapyBase / TherapyUpdate (models.py)
`indication: Optional[str] = None` added to both. GestioneTerapiaModal was already sending it
but Pydantic `extra="ignore"` silently dropped it. Retrocompatible — existing docs without the field still load.

### 3. LAB_KEY_CANONICAL_MAP + toCanonicalLabKey (labValueExtractor.js)
Exported from end of labValueExtractor.js. Auto-built from PARAMS + AUTOAB_QUAL + AUTOAB_NUMERIC
labels, then explicit overrides for common Italian abbreviations (pcr→crp, ferritina→ferritin, etc).
`toCanonicalLabKey(name)` imported in VisitImportButton.jsx and replaces the ad-hoc
`name.toLowerCase().replace(/[\s\-/]+/g, "_")` normalization in apply() lab exam saving.

**Why:** Without canonical keys, "PCR" would save as key `pcr` while LabValueDisplay expects `crp`
→ silent data mismatch on re-read.

### 4. `visit_category` on AssessmentBase (models.py)
`visit_category: Optional[str] = None` — values: `"score"` | `"instrumental"`.
- visitTextParser.js: sets `visit_category: "score"` on all clinimetry assessments.
- VisitImportButton.apply(): passes `visit_category: a.visit_category || "score"` for assessments,
  `visit_category: "instrumental"` for instrumental_findings block.
Retrocompatible — existing Assessment docs without the field remain valid (None).
