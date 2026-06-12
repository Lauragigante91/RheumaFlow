---
name: Drug alias single source of truth
description: DRUG_ALIAS_MAP in drugs.js is the canonical registry; parsers derive from it.
---

## Rule
To add a new drug or brand name alias, edit **only** `frontend/src/lib/drugs.js` — the `DRUG_ALIAS_MAP` export at the bottom of the file.

## Why
Before consolidation, aliases were duplicated across three files with divergent content and category naming. New drugs added to one file were invisible to the others.

## How to apply
- `DRUG_ALIAS_MAP` shape: `{ [lowercase_alias]: { canonical: string, category: string } }`
- `canonical` should match the `name` field in `DRUGS[]` above (or be a new drug name)
- `category` must be one of the keys in `CATEGORY_COLORS`: `csDMARD`, `bDMARD`, `tsDMARD`, `glucocorticoid`, `NSAID`, `analgesic`, `supportive`, `other`
- `therapyTextParser.js` imports `DRUG_ALIAS_MAP as DRUG_MAP` — no changes needed there
- `therapyEventParser.js` builds its `_DRUG_RE` regex at module init from `DRUG_ALIAS_MAP` keys
- `visitTextParser.js` derives `DRUG_PATTERNS` via an IIFE that groups aliases by canonical name

## Duplicate keys + orphan-alias category gap
DRUG_ALIAS_MAP historically carried two definitions per comorbidity drug: a
"poor" one (category "other"/base) in a topical block (Osteoporosi/Raynaud/
Analgesici/Supportivo) and a "rich" one lower down in the comorbidity catalog
(specific category + therapy_type + relevance). JS keeps the LAST, so the rich
one already won at runtime — dedup = delete the earlier occurrence (lossless).
**Gap still open:** non-duplicated orphan aliases in the topical blocks (e.g.
xgeva, osteomax, ibandronate, raloxifene, forsteo, nifedipine, omeprazole) keep
category "other" while their canonical sibling is enriched → same drug, different
metadata depending on which alias matched.
