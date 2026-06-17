---
name: Drug category normalization — CATEGORY_CANONICAL
description: DRUG_ALIAS_MAP uses legacy category keys; parser normalizes them at DRUG_PATTERNS build time via CATEGORY_CANONICAL. Don't change DRUG_ALIAS_MAP values.
---

## Rule
`DRUG_ALIAS_MAP` in `drugs.js` uses legacy category keys (`csDMARD`, `bDMARD`, `tsDMARD`, `glucocorticoid`, `NSAID`, `supportive`, `ppi`, `bisphosphonate`).

`therapySuggestions.js` depends on these legacy keys for its CATEGORY_LABELS map.

`visitTextParser.js` normalizes categories at DRUG_PATTERNS build time via the `CATEGORY_CANONICAL` table (declared just before `DRUG_PATTERNS`):

| DRUG_ALIAS_MAP value | Normalized output |
|---|---|
| csDMARD | dmard_conventional |
| bDMARD | dmard_biologic |
| tsDMARD | dmard_targeted |
| glucocorticoid | corticosteroid |
| NSAID | nsaid |
| supportive | supplement |
| ppi | other |
| bisphosphonate | other |

`RHEUM_CATEGORIES` (inside `parseVisitText`) uses the **normalized** names, not the legacy names.

**Why:** `therapySuggestions.js` reads `drugs.js` directly; changing DRUG_ALIAS_MAP values would break its category label display. The normalization layer decouples the canonical label map from the parser output schema.

**How to apply:**
- To add a new drug → edit `drugs.js` DRUG_ALIAS_MAP only.
- To add a new category that should appear in import proposals → add it to both `CATEGORY_CANONICAL` (if it needs renaming) and `RHEUM_CATEGORIES` in visitTextParser.js.
- Never change category values in DRUG_ALIAS_MAP to match the normalized names — that would break therapySuggestions.js.
