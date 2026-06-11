---
name: Lab canonical key alignment
description: How lab param_key values are assigned and how to avoid compound-slug keys in the DB.
---

## Rule

`param_key` (set by the parser) is always the canonical DB key.  
`name` / `label` is only for display — never use it to derive the DB key.

**Wrong (old bug):**
```js
toCanonicalLabKey(r.name)  // slugifies "Hb / Emoglobina" → "hb_emoglobina"
```

**Correct (fix in VisitImportButton.jsx ~line 199):**
```js
r.param_key || toCanonicalLabKey(r.name)  // uses pre-computed canonical key first
```

## Canonical key list (commonly confused)

| Display label | Canonical key | Old broken key |
|---|---|---|
| Hb / Emoglobina | `hb` | `hb_emoglobina` |
| GB / WBC | `wbc` | `gb_wbc` |
| PLT / Piastrine | `plt` | `plt_piastrine` |
| VES / ESR | `ves` | `ves_esr` |
| PCR / CRP | `crp` | `pcr_crp` or `pcr` |
| AST / GOT | `ast` | `ast_got` |
| ALT / GPT | `alt` | `alt_gpt` |
| Ferritina | `ferritin` | `ferritina` |
| Creatinina | `creatinine` | `creatinina` |
| Aldolasi | `aldolase` | `aldolasi` |
| Vitamina D | `vitd` | `vit_d` |
| Fattore Reumatoide | `fr` | `fattore_reumatoide_fr` |

## DB migration

`scripts/migrate_lab_keys.py` — REMAP dict covers compound-slug and old-panel-key variants.  
Ran successfully: 12 docs updated in `rheumaflow.lab_exams`.  
Add new entries to REMAP if new broken imports appear.

## labValueExtractor PARAMS additions

IgG, IgA, IgM added as standalone PARAMS (panel: `immunoglobuline`) with aliases:
- `\\bIgG\\b(?=\\s+\\d)` — requires digit directly after to avoid "anticardiolipina IgG" context
- `\\bIgA\\b(?=\\s+\\d)`, `\\bIgM\\b(?=\\s+\\d)` — same pattern

ANCA generic ("ANCA neg") not recognized; use `c-ANCA` / `p-ANCA` in text for extraction.

**Why:** The autoab extraction pass handles "anticardiolipina IgG" separately — the lookahead prevents PARAMS from stealing those matches.

## Regression tests

`frontend/src/lib/__tests__/parser_regression.js`:
- BUG-LAB-KEYS-1: no compound keys in date-group items
- BUG-LAB-KEYS-2: specific canonical keys present (crp, creatinine, hb, wbc, plt, ast, alt)
- BUG-LAB-KEYS-3: autoimmunità + complemento + IgG/IgA/IgM + c-ANCA/p-ANCA extracted
- BUG-LAB-KEYS-4: all items have non-null key
