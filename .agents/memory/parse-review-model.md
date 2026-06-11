---
name: Parse review confidence model
description: Architecture of _parse_review, SectionReviewPanel, and the 4 confidence signals in the visit import pipeline.
---

## Rule
`parseVisitText()` attaches `extracted._parse_review = { unresolved, low_confidence }` when it detects clinically significant ambiguities. Returns `null` when the referto is well-structured (most cases).

**Why:** The parser silently drops text it can't assign. For clinically critical sections (raccordo, terapia, conclusioni, indicazioni, esami) a misassignment is worse than no assignment — it looks correct but is wrong. Human-in-the-loop is triggered only for these.

## 4 signals (all in computeParseReview in visitTextParser.js)

| ID | Type | Condition | Suggested section |
|---|---|---|---|
| `raccordo_preamble` | unresolved | RACCORDO empty + cleanPreamble(PREAMBLE) has raccordoScore ≥ 3 | raccordo |
| `raccordo_in_allergie` | low_confidence | ALLERGIE body > 150 chars + rest after first line has raccordoScore ≥ 2 | raccordo |
| `esami_visione_in_pregressi` | low_confidence | ESAMI_PREGRESSI contains "In visione:" not caught as RECA_IN_VISIONE | labs_text |
| `indicazioni_in_conclusioni` | low_confidence | INDICAZIONI empty + CONCLUSIONI > 250 chars + ≥ 2 therapy action verbs | indicazioni |

## raccordoScore thresholds
- ≥ 3 → unresolved block (PREAMBLE case)
- ≥ 2 → low-confidence (ALLERGIE body case, less strict)
- Disease name: +2, diagnosi/esordio: +2, year: +1, past verbs: +1, stabile: +1, starts with "Paziente": +1, length > 100: +1
- Allergy phrases: -2

## UI flow
`step: "input" | "section_review" | "extracted_review"` in VisitImportButton.
- _parse_review non-null → step goes to "section_review" after parse()
- _parse_review null → step goes directly to "extracted_review" (unchanged UX)
- "Salta" or "Avanti →" both continue to "extracted_review"

## Section target keys (SectionReviewPanel.SECTION_TARGETS)
raccordo, anamnesi, esame_obj, **labs_text**, conclusioni, indicazioni, td

**labs_text** is the key for manually-assigned esami text in visit_sections.
It maps to workupVisitsApi.create({ labs_imaging }) via apply() in VisitImportButton.
VS_LABELS in VisitImportButton.jsx must include labs_text for VisitSectionsEditor to render it.

**How to apply:** Adding a new signal → add one entry in computeParseReview(), no UI changes needed.
