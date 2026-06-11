---
name: Therapy conflict detection architecture
description: How conflict detection between TERAPIE IN ATTO and INDICAZIONI works in visitTextParser.js, including parser quirks and SectionReviewPanel Group C UI.
---

## Rule
During import, therapies are extracted separately from DOM scope (TERAPIA_DOMICILIARE + IN_TERAPIA) and IND scope (INDICAZIONI). If the same drug appears in both with different dose or frequency, a `therapy_conflict` is emitted for human review. IND wins by default (final prescription > current list). The doctor must make an explicit choice in the review panel — no dismiss button.

**Why:** "TERAPIA IN ATTO" describes the baseline the patient arrived with; "INDICAZIONI" is today's active prescription. When they diverge, the rheumatologist must consciously decide which version to save.

## How to apply
- Conflict struct: `{ id, drug_name, source_dom: {dose,frequency,route,source_fragment}, source_ind: {...}, winner: "ind" }`
- `computeParseReview(S, raccordoText, visitSections, therapyConflicts)` → `_parse_review.therapy_conflicts`
- `SectionReviewPanel` Group C (red label, shown first): `TherapyConflictBlock` with two-column card; `handleTherapyConflictResolve` updates `extracted.therapies` via `onUpdate`
- `allIds` in SectionReviewPanel must include `therapy_conflicts.map(b => b.id)`

## Parser quirks fixed during implementation
1. **FREQ_INTERVAL slash-interval**: added `\/\s*(\d+)\s+settiman[ae]\b` to FREQ_INTERVAL so "40 mg/3 settimane" is matched. Then normalized `/3 settimane` → `ogni 3 settimane` after extraction.
2. **Context window spillover**: the 200-char context starting at a drug match can include the next drug's line. `FREQ_PER_WEEK` (high priority, fixed) was matching "15 mg/settimana" from Metotrexato while parsing Adalimumab. Fix: sort `[freqPwM, freqIntM, freqGenM]` by `.index` and pick the earliest match, not the highest-priority match.
3. **Conservative comparison**: only flag a conflict when BOTH sides have a non-null parsed value AND they genuinely differ. If one side is null (parsing gap), IND already wins in the merged list anyway — no false positive needed.

## Test cases
- TS01: Adalimumab 3w (DOM) vs 4w (IND) → conflict detected ✅
- TS02: Prednisone 5mg (DOM) vs 7.5mg (IND) → dose conflict ✅
- TS03: No IND section → no conflicts ✅
- TS04: Same drug same posology → no conflict ✅
- Metotrexato false positive (freq null on one side) → suppressed ✅
14/14 PASS
