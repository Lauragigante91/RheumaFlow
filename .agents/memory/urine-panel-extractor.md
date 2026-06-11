---
name: Urine panel + extractor pattern
description: Key alignment rules between labPanels.js and labValueExtractor.js for the urine panel, including the reverse-order extraction pattern for sediment counts.
---

## Key alignment rules

- `labPanels.js` key must be `proteinuria` (not `proteinuria_24h`) — extractor PARAMS uses `proteinuria`
- `labPanels.js` key must be `acr` (not `uacr`) — extractor PARAMS uses `acr`
- Panel label: "Urine / Proteinuria"

## Reverse-order extraction: "17 emazie/campo"

Italian lab reports write sediment counts as `VALUE LABEL/campo` (number before alias). The standard PARAMS regex looks for `alias + number` and cannot match this format.

**Fix:** `extractUrineCountValues()` with `URINE_COUNT_PATTERNS` (each has a literal regex with value as group 1). Called in `extractLabValues()` alongside other sub-extractors. Results added to `urineCountKeys` set so the PARAMS loop skips duplicates.

**Pattern keys:** `urine_rbc` (emazie), `urine_wbc` (leucociti). Unit: `/campo`.

## Strict vs soft matching (avoid blood-count false positives)

URINE_COUNT_PATTERNS split into strictRe (per-field unit REQUIRED: `/campo|al campo|p/campo|/HPF|x campo`; `/μL` and `/uL` dropped) and softRe (unit-less, only `emazie`/`piociti`, accepted ONLY when URINE_CONTEXT_RE — `EU|esame urine|sedimento|urinar|urine` — matches the preceding ~60 chars).

**Why:** "Globuli rossi 4.52 10^6/uL" and "Leucociti 12.4 K/μL" are emocromo (blood), not sediment — they were wrongly populating urine_rbc/urine_wbc. Requiring a per-field unit (or urine context for the bare emazie/piociti shorthand) prevents inventing urine sediment when absent.
**How to apply:** never let `/μL`-style blood units feed urine counts; eritrociti/globuli rossi/GR/leucociti need an explicit per-field unit; only the urine shorthand `emazie`/`piociti` may be unit-less, and only in urine context.

## Sediment count units extended (num/microL) + unit capture

`URINE_FIELD_UNIT` now also accepts `num/microL`, `cellule/[μµu]L`, `/[μµu]L` (formati AUSL/macchina). The strictRe wraps the unit suffix in a capture group (m[1]/m[2]=value, m[3]=unit); `normalizeUrineCountUnit(unit, fallback)` canonicalises it (soft path → fallback `/campo`). A `(?<![-–—])` lookbehind on the number-first branch blocks reference-range tails like "range 0-15" from being read as the count.

**Why:** a patch authored against an OLD single-regex `re`/`extractValue` design conflicted with the strict/soft architecture; adapting the intent (new units + unit capture + range-guard) into strict/soft kept the LAB-URINE-NOFP emocromo guards intact.
**How to apply:** NEVER revert urine count parsing to the patch's single-regex form — it drops URINE_CONTEXT_RE soft-gating and reopens blood-count false positives. Add new sediment units to `URINE_FIELD_UNIT` + `normalizeUrineCountUnit`.

## Qualitative urine fields: nitriti + esterasi_leucocitaria

PANEL_QUAL_LABELS also carries `nitriti` and `esterasi_leucocitaria`, plus per-label `absentLabel`/`presentLabel` (e.g. proteine→assenti/presenti, esterasi→assente/presente). `extractQualitativeResults` maps `assent[ei]`/`+{1,3}`/`tracce`/`present[ei]` to those labels. `emoglobina` (bare) moved from the emocromo Hb qual alias to `hemoglobinuria` — resolves the hb-vs-emoglobina-urinaria collision at the source.

## PANEL_QUAL_LABELS (qualitative urine findings)

Added: `hemoglobinuria`, `proteinuria_stick`, `urinary_casts`, `leucocituria`, `hematuria`. These match qualitative terms (neg/nn/nella norma) in the visit text.

**Why:** These findings don't have numeric values in Italian letters — they appear as "emoglobinuria neg", "cilindri assenti", etc. Using PANEL_QUAL_LABELS correctly routes them.
