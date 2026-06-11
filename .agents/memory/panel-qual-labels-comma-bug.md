---
name: PANEL_QUAL_LABELS comma bug
description: The PANEL_QUAL_LABELS regex had a comma in the terminal negative lookahead, blocking matches in comma-separated lists.
---

## The bug

`extractQualitativeResults` builds a regex for each PANEL_QUAL_LABELS entry ending with:
```
(?![\d.,])
```

This lookahead says "do NOT match if followed by digit, dot, OR comma". In a comma-separated lab list like:
```
IgG nei limiti, IgA nei limiti, IgM nei limiti
```

"IgG nei limiti" is followed by "," → the lookahead FAILS → no match. Only the LAST item in the list (no trailing comma) was ever extracted.

## Fix

Change `(?![\\d.,])` to `(?![\\d.])` — remove the comma from the exclusion set.

**Why:** Commas in lab reports are list separators, not part of numeric values. The original comma guard may have been a copy-paste error. The dot guard is still needed (prevents "1.5" being split after the integer).

## Detection

If a PANEL_QUAL_LABELS result only appears for the LAST item in a comma-separated list, suspect this bug. Run a unit test with "A nei limiti, B nei limiti, C nei limiti" — only C would be found before the fix.
