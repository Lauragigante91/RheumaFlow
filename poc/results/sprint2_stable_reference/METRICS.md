# Sprint 2 Stabilizzato — Metriche di Riferimento

Data: 2026-06-05

## Globali

| Metrica      | Sprint 1 | Sprint 2 | Delta |
|---|---|---|---|
| Macro-F1     | 0.789    | **0.880** | +0.091 |
| Micro-Pre    | 1.000    | **1.000** | =      |
| Micro-Rec    | 0.681    | **0.813** | +0.132 |
| Micro-F1     | 0.810    | **0.897** | +0.087 |
| TP           | 62       | **74**    | +12    |
| FP           | 0        | **0**     | =      |
| FN           | 29       | **17**    | -12    |
| Reason Recall| 0.909    | 0.792     | -0.117 |
| GT eventi    | 91       | 91        | =      |

## Obiettivi Sprint 2

| Obiettivo       | Risultato |
|---|---|
| Recall > 0.75   | 0.813 ✓   |
| Precision > 0.95| 1.000 ✓   |
| FP ≤ 2          | FP=0 ✓    |

## P2A — Switch verbs (+5 TP)

TC07: F1 0.89 → **1.00** (switch a Secukinumab)
TC10: F1 0.44 → **0.92** (passato a / sostituito con)

Verbi: passato a | sostituito con | switch a | convertito a
Pattern: therapy_stop(fromDrug) + therapy_start(toDrug)
Guard: fromDrug == toDrug → skip (cambio formulazione, non switch)
Fix key: prevLastDrug (non lastDrug aggiornato dalla frase corrente)

## P2B — Bullet list (+7 TP)

TC09: F1 0.22 → **1.00** (formato elenco puntato)

Pattern: "- YEAR[-YEAR]: Drug (sospeso per X)"
Caso A: sospensione/sospeso all'inizio → stop only
Caso B: range anni → start; stop solo se (sospeso per X) in parens

## Guard aggiuntiva applicata

Rule 2 (dal YEAR) — fallback lastSentenceDrugs disabilitato
se REMISSION_RE || FLARE_RE nella frase:
"Dal 2022 in remissione" non avvia terapia. (TC07 FP eliminato)

## FN residui (17)

| Categoria        | Count |
|---|---|
| MISSING_START    | 10    |
| MISSING_STOP     | 5     |
| DATE_MISMATCH    | 4     |
| REASON_MISSING   | 3     |
| REASON_PARTIAL   | 2     |
| MISSING_SPACING  | 1     |
| MISSING_DOSE_CHANGE | 1  |

TC01 (F1=0.57), TC04 (F1=0.86): out-of-scope Sprint 2
