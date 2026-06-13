---
name: Therapy total-dose computation
description: How extractDoseAndFrequency computes total daily dose and the FP=0 traps it must avoid
---

`extractDoseAndFrequency` exists in BOTH `therapyTextParser.js` (quick single-drug) and
`visitTextParser.js` (full visit, inside extractTherapies). It computes the TOTAL daily dose:
`unit dose × tablets/administrations × times-per-day`. Examples: "500 mg 5 cp die"→"2500 mg";
"16 mg 1/4 cp"→"4 mg"; "1 g x 2"→"2 g"; "2 cp la mattina e 2 cp la sera" are summed.

**Rule — frequency must be computed independently of dose presence.**
A no-dose drug still needs its interval/general frequency (e.g. "Infliximab ogni 8 settimane").
The no-dose branch must still evaluate FREQ_INTERVAL/FREQ_GENERAL (quick parser: FREQ_PATTERNS),
not only PRN.
**Why:** collapsing the no-dose path to "PRN-only" silently dropped "ogni 8 settimane" and broke
the dose-bleed regression (DOSEBLEED Infliximab).

**FP=0 traps (these fabricate data):**
1. Bare Italian preposition "di" must NOT be a daily-frequency token. "5 mg di mantenimento" /
   "10000 UI di mantenimento" are NOT "giornaliera". Only accept "di"/"dì" when preceded by "al"
   (al di / al dì); bare die|dì|giorno|day|qd stay valid.
2. "x N mesi/settimane/giorni/anni/gg" is a DURATION, not a per-day count — it must NOT multiply
   the dose. Guard the "x N" multiplier with a negative lookahead for those duration units.
   "x 2/die", "x 2 al giorno/al dì", and bare "x 2" must still multiply.

**Anti-spillover:** the visit parser passes the existing `doseScope` (cut before the next drug) to
extractDoseAndFrequency — do NOT add a separate context-cut helper; doseScope already prevents a
drug inheriting the next drug's dose.

**Note:** `colecalciferolo` canonicalizes to "Vitamina D3" (category `supportive`), which the visit
parser filters out of therapy proposals (only rheumatology categories surface). Use a rheumatology
drug (e.g. Prednisone, Sulfasalazina) when writing visit-parser dose/freq tests.
