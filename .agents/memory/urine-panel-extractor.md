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

## PANEL_QUAL_LABELS (qualitative urine findings)

Added: `hemoglobinuria`, `proteinuria_stick`, `urinary_casts`, `leucocituria`, `hematuria`. These match qualitative terms (neg/nn/nella norma) in the visit text.

**Why:** These findings don't have numeric values in Italian letters — they appear as "emoglobinuria neg", "cilindri assenti", etc. Using PANEL_QUAL_LABELS correctly routes them.
