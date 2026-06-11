---
name: Raccordo 3-letter drug aliases
description: The raccordoParser DRUG_ALIAS_SORTED filter excluded 3-letter abbreviations; fix details and undated event UI architecture.
---

## Rule
`DRUG_ALIAS_SORTED` in `raccordoParser.js` must use `alias.length >= 3` (not `>= 4`).
The `"lef"` alias for Leflunomide must exist in `DRUG_ALIAS_MAP` in `drugs.js`.

**Why:** MTX (Methotrexate), LEF (Leflunomide), AZA (Azatioprina), MMF (Micofenolato Mofetil), RTX (Rituximab) are all 3-letter abbreviations ubiquitous in Italian rheumatology raccordo text. The old `>= 4` filter silently discarded all of them, producing zero extractions.

**Safety:** All aliases use `\b` word-boundary matching, so 3-char sequences don't produce false positives in running text.

## Undated events (date_value=null) UI architecture
- **Import review** (`RaccordoEventsEditor`): dated events shown first (sorted ASC), undated events in a separate subsection "Eventi senza data" with a note that they won't appear on the dated timeline.
- **ClinicalTimeline**: dated events in the chronological timeline with vertical line; undated events in a flat subsection "Anamnesi senza data" below the timeline, with source fragment. Neither section hides them — they're always shown, just separated.
- **batchCreate**: saves events as-is; `date_value: null` is valid and saved normally by the backend.
