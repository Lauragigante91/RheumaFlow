---
name: Clinimetry comparative "da X a Y" dropped (candidate bug)
description: parseClinimetryFromText silently drops trend/comparative score expressions like "DAS28 da 5.1 a 3.2"; candidate bug, not yet patched pending real failing text.
---

CANDIDATE BUG (not patched — awaiting the user's exact real failing letter before touching it).

`parseClinimetryFromText` (used by the real "Importa da lettera" flow via `parseVisitText` -> `extracted.assessments`) extracts NOTHING from comparative/trend phrasings:
- "DAS28-CRP da 5.1 a 3.2" -> 0 items, 0 comparatives
- "CDAI migliorato da 22 a 8" -> 0 items

Plain values, multi-index lines, narrative-embedded scores, and out-of-scope scores all parse correctly; only the "da X a Y" trend form is lost.

**Expected behavior (to confirm with the doctor):** take the FINAL value (Y = 3.2 / 8) as the current score, optionally record the comparative (before -> after).

**Why holding:** the user wants to verify the exact clinical text that fails before any clinimetry patch; deterministic-parser, FP=0 discipline — do not widen on a synthetic guess.

**How to apply:** when given the real failing text, extend `clinimetryTextParser` for the "da X a Y" pattern; add a regression test that runs through `parseVisitText` (the real entrypoint), then re-run suite + `poc/audit_parser_live.js` (must stay FP=0).
