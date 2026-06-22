---
name: Homunculus joint parser — systemic recall gaps
description: Known parser bug families found by audit of parseJointExam (jointExamParser.js); audit harness method; use before any joint-parser fix.
---

`frontend/src/lib/jointExamParser.js` (`parseJointExam`) has systemic recall gaps. A read-only audit (55 real Italian clinical sentences, scored on homunculus key sets) found ~47% perfect; failures are dominated by silent false-negatives (under-count of disease activity), which is the higher clinical risk.

**Bug families (ranked by clinical impact):**
1. Plural "dolenti" not recognized by the pass-2 gate `TENDER_RE` (it uses `dolente[/i]?` — a char class, not `dolent[ei]`). Clauses whose only marker is "dolenti" are skipped. Pass-1 labeled blocks (which use `dolent[ei]`) can still catch it if "dolenti" precedes the joint segment, so it's not literally global.
2. Singular "polso" not matched: wrist rule `\bpolsi?\b` matches only "polsi"; "polso"=pols+o fails the trailing `\b`. Wrist is a DAS28 joint → high impact.
3. Status-AFTER-joint adjectival form ("Spalla sinistra dolente", "Caviglia destra tumefatta", "Gomito ... sinovite") → 0 joints: pass-2 splits on the status keyword and carry-forward is forward-only, never backward.
4. Masculine laterality "destro"/"sinistro" not in `parseSides` (only destra/sinistra/dx/sn/ds/dex/sin) → defaults to BILATERAL → contralateral false positive (over-count + wrong side, gonfia DAS28).
5. Negation gap: `NEG_RE` lacks adjectival "non dolenti"/"non tumefatte" → swollen false positives on explicitly-negated/OA joints.
6. Sacroiliac unrepresentable: no SI rule in JOINT_DEFS and no SI key in `Homunculus.jsx` FRONT_JOINTS (matters for SpA).
7. Enumeration "X e Y" between digits not parsed: `extractNumbers` chain sep is only `[-–,+]`; "MCP II e III" captures only the first number.
8. Laterality spillover: segment-level `parseSides` returns bilateral when a segment lists "joint1 destra e joint2 sinistra", or applies a single side cue to later joints lacking their own side.
9. "MTF" not normalized to MTP (expandAbbreviations only maps MCF→MCP), even though the UI uses "MTF" as the display label.
Minor latent: `extractNumbers` doesn't enforce the family's lower bound, so "DIP 1" could emit a non-existent `dip1` key.

**Status:** ALL 9 bug families RESOLVED.
- Families 1–5: RESOLVED in P0 fix (already merged).
- Family 6 (sacroiliac): RESOLVED — si_l/si_r in JOINT_DEFS + SWOLLEN_RE + Homunculus.jsx; excluded from TJC/SJC counts; tests #30/31/32 promoted active; 7/7 new cases pass.
- Families 7 (BUG-G "X e Y" numeric enum), 9 (BUG-I MTF→MTP), plus G2/G5/G7: RESOLVED in Task #43 (IMPLEMENTED, pending merge).
- Family 8 (laterality spillover): mitigated via NEXT_JOINT_RE window.
- Zero open audit gaps.

**Durable gotcha — accented terminal `\b`:** Italian status words ending in an accented vowel (`dolorabilità`, `positività`) break a trailing JS `\b`, because the accented char is `\W` and a following space is also `\W` → no boundary. Symptom: the word is silently NOT recognized as a status marker when followed by space/punct, so a mixed "tumefazione … dolorabilità …" clause collapses to swollen-only and over-marks SJC. Fix pattern: end such alternations with `(?![\wàèéìòù])` instead of `\b`. Applied to `TENDER_RE` and the pass-2 split regex; pass-3 `jointFirst` (joint-first colon form `polso dx: dolorabilità …`) still has the raw `\b` but is not exercised by any audit case — fix only if joint-first colon syntax becomes in-scope.

**Test:** `frontend/src/__tests__/jointExamParser.test.js` embeds the 55-case corpus (out-of-scope ones `test.skip`) + asserts status AND tjc/sjc on the mixed-laterality cases, not just joint keys — the key-only audit missed the SJC inflation.

**Why:** these are subtle (regex typo, singular/plural boundary, forward-only carry, non-ASCII word boundary) and easy to rediscover the hard way; the under-count families are clinically the most dangerous.

**Audit harness method (reproducible):** write an `.mjs` importing `parseJointExam`, bundle with `cd frontend && npx esbuild <file> --bundle --platform=node --outfile=/tmp/out.cjs --format=cjs && node /tmp/out.cjs`. Score each case by comparing the parser's joint-key set vs an expected key set; derive laterality errors via base/side diff (`baseOf`=strip `_l`/`_r`). Encode sacroiliac as pseudo-keys (si_l/si_r) to mark them unmappable.
