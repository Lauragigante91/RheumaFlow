---
name: Therapy discontinuation parser rules
description: How PAST_BEFORE_RE / PAST_AFTER_RE / SOSP_NARROW_AFTER_RE work, the narrative-scope bug, and the multi-import seenDrugs bug fix.
---

## Critical architectural constraint

`extractTherapies()` is called with `_domScope` (TERAPIA DOMICILIARE + IN TERAPIA) and `_indScope` (INDICAZIONI) **only** — it never sees ANAMNESI INTERVALLARE. A drug listed as active in TERAPIA DOMICILIARE but noted as suspended in ANAMNESI INTERVALLARE will be classified "active" because its ctxBefore/ctxAfter are scoped to the therapy section alone.

**Fix**: `applyNarrativeDiscontinuations(therapies, narrativeText, RHEUM_CATEGORIES)` runs after `extractTherapies` and scans narrative sections (ANAMNESI_INTERVALLARE + MOTIVO_VISITA + RACCORDO + VISITA_ODIERNA) for discontinuation signals. Two cases handled:
- **Case A**: Drug already in list with `status: "active"` → override to `discontinued`
- **Case B**: Drug NOT in list (omitted from TERAPIA DOMICILIARE because already suspended) → emit new `discontinued` entry if `RECENT_DISC_BEFORE_RE` fires (avoids resurrecting old historical therapies)

## Signal rules

### PAST_BEFORE_RE (ctxBefore, 250 chars before drug name)
- Historical: "in passato", "pregressa", "ha effettuato", "ha assunto"
- Patient suspension: "mantiene sospesa/o", "ha sospeso/interrotto/smesso/cessato", "paziente ha sospeso/interrotto", "sospende/interrompe in autonomia", "sospesa dalla paziente", "non ha iniziato/assunto/preso"

### RECENT_DISC_BEFORE_RE (subset of PAST_BEFORE_RE for Case B only)
Excludes pure historical signals ("in passato", "ha assunto", "pregressa") — these are too broad and would emit false discontinued entries for drugs that have been closed long ago.

### PAST_AFTER_RE (ctxAfter, 200 chars after drug name)
- Parenthetical: `(non tollerato)`, `(sospeso)`, `(controindicato)`
- Free text: "sospesa per intolleranza", "interrotta dopo 2 giorni", "non tollerata", "non iniziata"

### SOSP_NARROW_AFTER_RE (first 80 chars of ctxAfter, override for inActiveSection)
Catches immediate qualifiers even inside TERAPIA IN ATTO section.

## Discontinuation reason extraction (`_extractDiscReason`)

Priority:
1. `PAST_AFTER_RE` match (parenthetical or free-form with keyword anchor)
2. Clinical keyword "per X" regex (nausea, diarrea, intolleranza, tossicità, dolore, ...)
3. Generic "per X" fallback (first 80 chars of ctxAfter)

Result stored in `discontinuation_reason` and `notes` on the therapy object.

## Multi-import seenDrugs bypass (visitReconciler.js)

When importing 2 visits in the same batch (visit 1 = drug active, visit 2 = drug discontinued), `seenDrugs` normally marks the second occurrence as CONTINUITY+_skip. Fix: check `t.status === "discontinued"` before returning CONTINUITY → return UPDATE+_skip:false+_action:"discontinue" instead.

**How to apply:** Any drug that can appear in multiple letters of the same import batch with different statuses needs this bypass.
