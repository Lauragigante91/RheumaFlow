---
name: Dose-range escalation parser (DOSE_RANGE_RE)
description: "da X a Y" dose escalation extraction and its FP=0 guards in visitTextParser
---

DOSE_RANGE_RE in `visitTextParser.js` extracts the FINAL dose from "da X a Y" escalation phrasings ("da 150 mg a 300 mg" → 300; "da 150 a 300 mg" → 300). The target after "a" MUST carry a dose unit, otherwise no match.

Design decisions (non-obvious, FP=0-driven):
- **Concentration-unit allow-list after slash.** A nested negative lookahead after the target unit REJECTS the range when a slash denominator is NOT a dosing one. Allowed (dosing): die, giorno/i, dì, gg, settimana/e, sett, mese/i, kg, m2, m², h, ora. Rejected (concentration → it's a lab value, not a dose): /L, /dL, /mL, /µg, /mcg, /ng.
  - **Why:** biologic trough levels ("livelli da 2 µg/mL a 6 µg/mL") and labs ("PCR da 2 mg/L a 4 mg/L") are common in this domain; without the guard the escalation matcher would extract the lab's upper value as a dose.
- **`[ \t]` not `\s` inside the regex.** Source dose, optional interval and target must stay on one line; `\s` would let "da X" on one line bridge to "a Y" on another.
  - **Why:** prevents cross-line/cross-sentence false ranges.
- **Optional bounded interval phrase between source and "a".** `(?:ogni N settimane/mesi/giorni)?` lets "da 150 mg ogni 4 settimane a 300 mg ogni 2 settimane" match; `freqCtx` (in extractDoseAndFrequency) then prefers the POST-target frequency so the NEW regimen wins, falling back to full context otherwise.

Conscious scope limits (do NOT "fix" without a real failing case):
- **twoDaysWeekM / "giorno a settimana" / PRN detectors still scan full `context`, not post-target.** Only freqIntM/freqGenM route through `freqCtx`. **Why:** they select among frequencies literally stated in the text (never invent data) → not an FP; routing all of them adds risk on the sensitive PRN surface for marginal gain.
- **Weight-based ranges "da 5 mg/kg a 10 mg/kg" intentionally do NOT match DOSE_RANGE_RE** (the source "/kg" breaks "a" contiguity, same as before this work); falls back to generic DOSE_RE (picks the source value). Pre-existing behavior, out of scope.

Related: "TERAPIE PREGRESSE/SOSPESE/STORICHE" is routed BEFORE TERAPIA_DOMICILIARE (letterSectionParser SECTION_DEF order, first-match-wins); past-scope drugs are filtered to rheum categories, deduped vs active canonical names, and forced `discontinued` — never contaminating home therapy.
