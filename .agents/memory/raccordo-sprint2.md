---
name: raccordoParser Sprint 2 — P2A switch verbs + P2B bullet list
description: Implementazione e fix per verbi di switch (passato a / sostituito con) e formato elenco puntato (2010-2012: Drug).
---

## P2A — Switch verbs

`SWITCH_VERB_RE = /\b(?:passato\s+a|sostituit[oa]\s+con|switch(?:ato)?\s+a|converiti?\s+a)\b/i`

Semantica: `therapy_stop(fromDrug) + therapy_start(toDrug)`

**Regola critica:** usare `prevLastDrug` (lastDrug salvato PRIMA dell'aggiornamento della frase corrente) come fallback per fromDrug — NON `lastDrug`. La frase "passato a Golimumab" aggiorna `lastDrug = Golimumab` prima che la rule 2c giri; usare `lastDrug` causerebbe `fromDrug == toDrug` → guard di formulazione scatterebbe erroneamente.

**Guard formulazione:** se `fromDrug.canonical === toDrug.canonical` → skip (cambio ev→sc non è switch). Usare `prevLastDrug` per il confronto, non `lastDrug`.

**Date cross-sentence:** `lastExtractedDate` aggiornato a ogni frase (anche senza drug); usato come fallback quando `extractDate(sentence) == null` nella frase dello switch.

**Why:** "Nel 2017 perdita di risposta; passato a Golimumab" — la data 2017 è in una frase separata dal ";", non nella frase con il verbo switch.

## P2B — Bullet list

`BULLET_LINE_RE = /^(?:[-•*]\s*)?(\d{4})(?:-(\d{4}|oggi))?\s*[:–]\s*(.+)/i`

`splitSentences`: split su `\n+` (non più solo `\n{2,}`) per separare le righe del bullet list.

**Caso A** — keyword "sospensione/sospeso" all'inizio del contenuto: emit solo stop per drug nel `stopScope` (testo prima della prima virgola → esclude "proseguita HCQ").

**Caso B** — range anni senza keyword principale: emit start per tutti i drug; emit stop solo se `(sospeso per X)` in parentesi nel contenuto.

**"oggi" come stopYear:** trattato come null → solo start, mai stop.

## Guard Rule 2 — Remission context

Quando `REMISSION_RE || FLARE_RE` matcha nella frase, disabilita il fallback `lastSentenceDrugs` nella Rule 2 (dal YEAR). "Dal 2022 in remissione clinica" non deve generare `therapy_start` su lastDrug.

**Why:** TC07 FP — dopo switch a Secukinumab, "Dal 2022 in remissione" usava lastSentenceDrugs=[Secukinumab] → `therapy_start(Secukinumab, 2022)` spurio.

## Risultati Sprint 2

Sprint 1 baseline: TP=62 FP=0 FN=29 Macro-F1=0.789 Precision=1.000
Sprint 2 finale:   TP=74 FP=0 FN=17 Macro-F1=0.880 Precision=1.000 Recall=0.813
TC09 (bullet): F1 0.22→1.00; TC07 (switch): F1 0.89→1.00; TC10 (switch): F1 0.44→0.92
