---
name: raccordoParser Rule 0C — Structured History List
description: Architettura e guard di Rule 0C (Variante B) nel raccordoParser; pattern trigger, esclusioni categoria, guard hasExplicitStart.
---

## Regola

Rule 0C spara nella frase quando:
- `CLASS_LABEL_RE` matcha (cDMARDs, bDMARDs, biologici, tsDMARDs, farmaci di fondo, immunosoppressori)
- OPPURE `HISTORY_VERB_RE` matcha: `trattat[oiea](?:\s+\w+)?\s+con` | `poi con` | `in terapia con`

Emette `therapy_start` con `confidence:"medium"`, `inferred_by:"list_parse"` per ogni drug non filtrato.

NON usa `continue` — Rule 3 (stop) può ancora sparare sulla stessa frase.

## Guard critici

### Guard 1 — hasExplicitStart
Se la frase contiene già `START_VERB_RE` (avviato, aggiunto, iniziato…) O `DAL_YEAR_EXT_SRC` (dal 2007…), Rule 0C NON spara.

**Why:** Rule 2/2b emettono start datati (confidence high). Rule 0C emetterebbe un duplicato undated. Il dedup finale usa `event_type::canonical::date_value` come chiave — null ≠ "2007-01-01", quindi il duplicato sopravvive come FP.

**Come si applica:** `const hasExplicitStart = START_VERB_RE.test(sentence) || new RegExp(DAL_YEAR_EXT_SRC,"i").test(sentence);`

### Guard 2 — categorie escluse
Oltre a `ANCILLARY_CANONICALS` (categoria "supportive"), Rule 0C esclude anche:
- `category === "NSAID"` (es. FANS)
- `category === "analgesic"` (es. Paracetamolo, Tramadolo)

**Why:** questi farmaci appaiono in frasi "trattata con FANS e MTX" ma il GT clinico non li include nella timeline reumatologica. ANCILLARY_CANONICALS filtra solo "supportive" — aggiungere NSAID/analgesic globalmente sarebbe eccessivo.

## Metriche baseline Sprint 3A

| Fix | TP | FP | FN | Macro-F1 |
|---|---|---|---|---|
| Sprint 2 stable | 74 | 0 | 17 | 0.880 |
| +3A-1 +3A-5 | 74 | 0 | 17 | 0.880 |
| +Rule 0C | **76** | **0** | **15** | **0.895** |

## FP emersi nella prima iterazione (risolti con le guard)

1. **TC12**: "aggiunto Infliximab… cDMARD" → CLASS_LABEL_RE + START_VERB_RE (aggiunto) → hasExplicitStart guard blocca Rule 0C ✓
2. **TC03**: "in terapia con HCQ dal 2015" → HISTORY_VERB_RE + DAL_YEAR → hasExplicitStart guard ✓
3. **TC04**: "trattata con FANS e MTX" → NSAID category exclusion ✓

## Invariante di dedup

Il dedup finale usa `event_type::drug_canonical::date_value`. Due start per lo stesso drug con date diverse (null vs "2007") NON vengono deduplicati — l'hasExplicitStart guard è l'unica protezione.
