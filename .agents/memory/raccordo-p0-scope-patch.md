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
A follow-up "P0.1 hardening" then tightened the three risk surfaces below.

**Rule:** treat these as the FP/FN-watch surfaces for any future parser change, and
always re-run `bash poc/build.sh && node poc/audit_parser_live.js` requiring FP=0
(precision 100%) before accepting.

**Why:** they are deliberately permissive and the 15-case corpus does not exercise
real-PDF variety, so regressions here are invisible to the audit:
- `extractClinicalScope` is **passthrough only when no recognized heading matches**;
  the moment ANY supported heading is present it KEEPS only scoped sections and
  silently drops everything else → FN risk on real PDFs under unlisted headings.
  Hardened: STORIA TERAPEUTICA / TERAPIE PREGRESSE / DECORSO CLINICO now recognized;
  extend this heading list (line-anchored) when new real-PDF headings appear.
- bare `ripres[oa]` (anaphora_restart) can fire on disease-flare "ripresa di
  attività/malattia/artrite/uveite". Hardened: flare list broadened in
  `isExcludedTimelineSentence`. Residual: `attivita|attività` is broad and will
  also drop "ripresa di attività fisica/lavorativa" — acceptable under FP=0, but if a
  real therapy event shares that sentence it becomes an FN; narrow to
  `attivit[aà]\s+(?:di\s+)?(?:malattia|infiammatoria|clinica|artritica)` if it bites.
- `bounded_course_range` mis-attribution in multi-drug sentences. Hardened: now emits
  a stop ONLY when exactly one eligible prior drug (`beforeRangeDrugs.length === 1`),
  else nothing (deliberate FN over wrong-drug FP). Still does not check rangeHandledStops.

**How to apply:** when extending, add real-PDF heading variants to the scope regexes
and broaden the flare-exclusion list rather than loosening the restart cue. The
lastDrug ancillary filter is only on the main `if (drugs.length>0)` block — bullet-list
branches still set lastDrug unfiltered. Good future tests: "ripresa di attività fisica"
(must NOT restart) and a multi-drug bounded-course sentence (must emit no stop).
