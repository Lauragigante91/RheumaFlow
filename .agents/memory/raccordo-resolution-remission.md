---
name: Non-pharma resolution -> remission, placement + date positioning
description: Why the resolution-remission rule sits before the onset block and slices the date after the keyword.
---

# Non-pharmacologic resolution → remission (raccordoParser)

A sentence like "Quadro clinico esordito nel 2013 ... risolto dopo il parto (2018)" must emit BOTH `disease_onset` (2013) AND `remission` (2018).

**Rule:** detect `RESOLVED_NONPHARMA_RE` (risolt[oaei]/risoluzione) gated by `NONPHARMA_RESOLUTION_CTX_RE` (dopo il parto / la gravidanza / il puerperio / post-partum). "risolto dopo sospensione del farmaco" never reaches here — it is filtered upstream by `isExcludedTimelineSentence`.

**Why placement matters:** the onset block (Rule 1) ends with `continue`, so any event co-located in an onset sentence is skipped if emitted AFTER it (Rule 5 remission would never fire). The resolution-remission block ("Rule 1pre") must sit BEFORE the onset block.

**Why date positioning matters:** the resolution date must come from `extractDate(sentence.slice(resM.index))` — i.e. text AFTER the resolution keyword — otherwise `extractDate(full sentence)` returns the ONSET year (2013) first. Slicing forward grabs the parenthetical "(2018)".

**FP watch:** the gate is narrow but not zero — a generic symptom sentence ("lombalgia risolta dopo il parto (2018)") would also become a `remission`. Live audit is FP=0; if such cases appear, tighten by requiring a disease-level subject (quadro/malattia/artrite/sintomatologia). Tests: RACC-REMISSION-RESOLVED-1/2/3.
