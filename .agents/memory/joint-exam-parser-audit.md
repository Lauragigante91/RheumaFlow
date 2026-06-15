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

**Why:** these are subtle (regex typo, singular/plural boundary, forward-only carry) and easy to rediscover the hard way; the under-count families are clinically the most dangerous.

**Audit harness method (reproducible):** write an `.mjs` importing `parseJointExam`, bundle with `cd frontend && npx esbuild <file> --bundle --platform=node --outfile=/tmp/out.cjs --format=cjs && node /tmp/out.cjs`. Score each case by comparing the parser's joint-key set vs an expected key set; derive laterality errors via base/side diff (`baseOf`=strip `_l`/`_r`). Encode sacroiliac as pseudo-keys (si_l/si_r) to mark them unmappable.
