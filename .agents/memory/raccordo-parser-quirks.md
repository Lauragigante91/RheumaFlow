---
name: Raccordo timeline parser quirks
description: Key design decisions and bugs fixed in raccordoParser.js during initial implementation.
---

## Rule: DAL_YEAR must use position-based scanning

When extracting therapy_start events via "dal YEAR" patterns in `raccordoParser.js`, **never use a single greedy regex** like `/\bdal?\s+((19|20)\d{2})\b(.{0,130})/gi`. The `.{0,130}` context group consumes subsequent "dal YEAR" occurrences within the same sentence.

**Example failure**: "...dal 2009 in monoterapia con ... (Adalimumab, dal 2019 Adalimumab Biosimilare)" — the greedy match on "dal 2009" consumes "dal 2019" inside its context group, so "dal 2019" is never matched as a separate start event.

**Fix** (`DAL_YEAR_POS_RE`): Find each "dal YEAR" by position only (no context group), then manually slice `sentence.slice(afterPos, afterPos + 130)` and run `findDrugsInText` on that slice independently. This lets each "dal YEAR" produce its own therapy_start event.

```javascript
const DAL_YEAR_POS_RE = /\bdal?\s+((19|20)\d{2})\b/gi;
// Usage:
while ((m = dalPosRe.exec(sentence)) !== null) {
  const afterPos = m.index + m[0].length;
  const context = sentence.slice(afterPos, afterPos + 130);
  const drug = findDrugsInText(context)[0];
  // ...
}
```

**Why:** The `gi` flag advances `lastIndex` past the entire match (including context), so a greedy context group silently skips inner occurrences.

## Rule: Stop date extraction must exclude "dal YEAR"

In a compound sentence like "MTX e LEF sospesi per inefficacia e dal 2009 in monoterapia con Adalimumab", calling `extractDate(sentence)` returns "dal 2009" (→ 2009-01-01) as the stop date for MTX/LEF. But "dal 2009" is the START of Adalimumab, not the stop date of MTX/LEF (which has no explicit date).

**Fix** (`extractStopDate(sentence, stopPos)`): A separate extractor that only accepts "nel/del YEAR" or month/year patterns within a ±30/+60 char window around the stop keyword. "dal YEAR" is never accepted as a stop date.

**Why:** "dal YEAR" semantically introduces a therapy start, never a stop. Stop dates use "nel 2016" / "del 2016" prepositions.

## Rule: Reason extraction must split at "e dal"

`extractReason(sentence)` regex `/\bper\s+([^.,;:\n]{3,60})/i` captures everything after "per" up to 60 chars. In "sospesi per inefficacia e dal 2009 in monoterapia", this produces "inefficacia e dal 2009 in monoterapia" as the reason — verbose and wrong.

**Fix**: split the captured group at `/\s+e\s+dal?\s+|\s+con\s+/i` (in addition to existing `con` split):

```javascript
m[1].trim().split(/\s+e\s+dal?\s+|\s+con\s+|\s+e\s+riacutiz/i)[0].trim().slice(0, 60)
```

## TS01 test vector (11 events)

TS01 raccordo text → expected 11 events:
1. disease_onset, 1985, (no drug)
2. manifestation_onset, 1994, manifestazioni psoriasiche cutanee
3. therapy_start, 2009, Adalimumab
4. therapy_start, 2019, Adalimumab (biosimilare)
5. therapy_stop, null date, Metotressato, reason: inefficacia
6. therapy_stop, null date, Leflunomide, reason: inefficacia
7. therapy_stop, 2016, Adalimumab, anaphora ("del farmaco"), reason: focolaio pneumonico
8. remission, 2021
9. dose_spacing, 2022-09, Adalimumab, 3wk, anaphora
10. dose_spacing, 2024-12, Adalimumab, 3wk, anaphora
11. dose_spacing, 2025-06, Adalimumab, 4wk, anaphora

Verified passing as of initial implementation.
