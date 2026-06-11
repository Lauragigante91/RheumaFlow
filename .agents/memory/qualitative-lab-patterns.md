---
name: Qualitative lab extraction: ANCA, antifosfolipidi, complement, immunoglobulins, viral serology
description: Patterns for extracting group qualitative labs — ANCA generic, antifosfolipidi group, C3/C4/C1q non consumato, IgG/IgA/IgM nei limiti, HBV/HCV/HIV, hemoglobinuria.
---

## Critical regex rule: Italian gender/number agreement for neg/pos

All extractor patterns must use `neg(?:ativ[oaie]?)?` and `pos(?:itiv[oaie]?)?` (NOT `[oa][ei]?`).

**Why:** Italian adjectives inflect: negativo/negativa/negativi/negative and positivo/positiva/positivi/positive.
The old pattern `neg(?:ativ[oa][ei]?)?` covers o/a but NOT i/e directly (requires [oa] first).
Combined with the `(?![\w\d])` lookahead in POS_NEG_PAT, "neg" alone fails within "negativi" (next char 'a' is \w).
Fix: `[oaie]?` after `ativ` → "negativi" matches in full → lookahead passes on what follows.

This fix is applied in 4 places:
1. `POS_NEG_PAT` in `extractAutoantibodies` (AUTOAB_QUAL loop, strict lookahead)
2. `parseAbStatus` (called after the capture group matches)
3. `extractQualitativeResults` PARAMS loop qualifier pattern (laxer `(?!\d)` lookahead)
4. `extractQualitativeResults` PANEL_QUAL_LABELS loop qualifier pattern
5. `anaQRe` in `extractAutoantibodies` (ANA qualitative without titer)

## ANCA generico (key: `anca`)

Added to `AUTOAB_QUAL` AFTER `anca_mpo`. Must come last so specific subtypes (anca_pr3, anca_mpo) fire first.

Alias: `(?<![cp]-)\\bANCA\\b(?![-/\\s]*(?:PR3|MPO)\\b)`

- Lookbehind `(?<![cp]-)` prevents matching "c-ANCA" and "p-ANCA"
- Negative lookahead prevents matching "ANCA PR3", "ANCA-MPO"
- "ANCA negativi" → POS_NEG_PAT matches "negativi" in full → key=`anca`

## Antifosfolipidi gruppo (key: `antifosfolipidi`)

Also in `AUTOAB_QUAL`. Aliases:
- `anticorpi\\s+antifosfolipidi\\b` — matches "Anticorpi antifosfolipidi negativi"
- `\\bantifosfolipidi\\b(?!\\s+(?:IgG|IgM|IgA)\\b)` — standalone; excludes specific isotype forms

## C3/C4/C1q qualitative ("non consumato")

Handled via `extractQualitativeResults` PARAMS loop. These params already have aliases (C3/C4/C1q).

Qualifier: `non\\s+consumat[oaie]?` — covers consumato/consumata/consumati/consumate.
Lookahead: `(?!\d)` (laxer than AUTOAB_QUAL) — allows qualifier to match within larger words.

No new key needed — same `c3`/`c4`/`c1q` keys.

## IgG/IgA/IgM qualitative ("nei limiti")

Added to `PANEL_QUAL_LABELS` (NOT PARAMS). Using the same key as PARAMS numeric entries.

Alias: `\\bIgG\\b(?!\\s*\\d)` — matches only when NOT followed directly by a digit. This distinguishes:
- "IgG nei limiti" → PANEL_QUAL extracts qualitative
- "IgG 1100 mg/dL" → alias fails (digit follows) → PARAMS numeric loop extracts

**Comma fix:** PANEL_QUAL_LABELS regex uses `(?![\d.])` (no comma) so "IgG nei limiti, IgA nei" works.

## HBV/HCV/HIV viral serology (keys: `hbv`, `hcv`, `hiv`)

Added to `AUTOAB_QUAL` after crioglobuline. Panel = "autoanticorpi" (set by makeAbResult — shared with all AUTOAB_QUAL entries).

Aliases:
- HBV: `\\bHBV\\b`, `\\bHBsAg\\b`, `epatite\\s+B`
- HCV: `\\bHCV\\b`, `anti.?HCV\\b`, `epatite\\s+C`
- HIV: `\\bHIV\\b`, `anti.?HIV\\b`

**Note:** These are NOT in LAB_CATALOG (which only exports PARAMS + PANEL_QUAL_LABELS) — they're auto-detected only, not searchable in the inline catalog.

## Hemoglobinuria / emoglobina urine

In `PANEL_QUAL_LABELS` key `hemoglobinuria`. Aliases include:
- `emoglobinuria`, `Hb\\s+urine`, `hemoglobinuria`
- `emoglobina\\s+(?:nelle?\\s+)?urin[ae]?` — catches "emoglobina urine" / "emoglobina nelle urine"
- `Hb\\s+stick` — dipstick shorthand

**PANEL_QUAL_LABELS extractor now supports BOTH qualifiers:**
- Normal/negative → `qualitative: "nella norma"`, `status: "normal"`
- Positive (`+`, `pos...`, `positiv...`) → `qualitative: "positivo"`, `status: "positive"`

This was a bug: the extractor previously only handled negative/normal qualifiers, discarding "emoglobinuria positiva".

## Qualifier normalization

- PARAMS loop: qualitative = "nella norma" for all matches (neg-like qualifiers map to normal)
- PANEL_QUAL_LABELS loop: qualitative derived from matched qualifier (positivo or nella norma)
- AUTOAB_QUAL loop: uses `parseAbStatus()` → returns "negativo"/"positivo"/"nella norma"

## Extended qualifier terms (current state)

All patterns use:
- `neg(?:ativ[oaie]?)?` → negativo/a/i/e + bare "neg"
- `pos(?:itiv[oaie]?)?` → positivo/a/i/e + bare "pos" + "+"
- `non\\s+consumat[oaie]?` → complement qualitative
- `nei\\s+limiti` → nella norma
- `nn` → nella norma shorthand
