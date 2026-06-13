---
name: Raccordo P0 scope/alias FP-watch surfaces
description: Design + risk notes for the extractClinicalScope / anaphora_restart / bounded_course_range additions to raccordoParser.js
---

# Raccordo P0 scope/alias patch — FP/FN watch surfaces

The P0 scope/alias work added four cooperating pieces to `raccordoParser.js`:
`extractClinicalScope`, `isExcludedTimelineSentence`, `anaphora_restart`
(implicit restart on bare `ripres[oa]`), and `bounded_course_range`
(`(MM/YYYY-MM/YYYY)` + "per N cicli/induzione" → therapy_stop). On the 15-case
live audit it lifted Macro-F1 0.895→0.942, recall 83.5%→90.1%, FP=0, regression 300/300.

**Rule:** treat these as the FP/FN-watch surfaces for any future parser change, and
always re-run `bash poc/build.sh && node poc/audit_parser_live.js` requiring FP=0
(precision 100%) before accepting.

**Why:** they are deliberately permissive and the 15-case corpus does not exercise
real-PDF variety, so regressions here are invisible to the audit:
- `extractClinicalScope` is **passthrough only when no recognized heading matches**;
  the moment ANY supported heading is present it KEEPS only scoped sections and
  silently drops everything else → FN risk on real PDFs whose timeline lives under
  unlisted headings ("STORIA TERAPEUTICA", "TERAPIE PREGRESSE", "DECORSO CLINICO")
  while a supported heading (TERAPIA DOMICILIARE/CONCLUSIONI) elsewhere flips scoping on.
- bare `ripres[oa]` (anaphora_restart) can fire on disease-flare "ripresa di
  attività di malattia/artrite/uveite/nefrite"; only a fixed list is fenced by
  `isExcludedTimelineSentence`.
- `bounded_course_range` does not set/check `rangeHandledStops` and picks
  `beforeRangeDrugs[0]` (first prior drug, not nearest) → possible duplicate or
  mis-attributed stop in multi-drug sentences.

**How to apply:** when extending, add real-PDF heading variants to the scope regexes
and broaden the flare-exclusion list rather than loosening the restart cue; if you
touch bounded ranges, prefer nearest-prior drug + rangeHandledStops dedup. The
lastDrug ancillary filter is only on the main `if (drugs.length>0)` block — bullet-list
branches still set lastDrug unfiltered.
