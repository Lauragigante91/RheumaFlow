# Sprint 1 Stabilizzato — Metriche di Riferimento

Data: 2026-06-05
Commit: sprint1-stable (checkpoint dd8414cc → 2e68f91f)

## Globali

| Metrica      | Valore |
|---|---|
| Macro-F1     | 0.789  |
| Micro-Pre    | 1.000  |
| Micro-Rec    | 0.681  |
| Micro-F1     | 0.810  |
| TP           | 62     |
| FP           | **0**  |
| FN           | 29     |
| Reason Recall| 0.909  |
| GT eventi    | 91     |

## Vincolo di precisione

**FP = 0 / Precision = 1.000**
Questo è il baseline di riferimento per Sprint 2.
Se FP > 2 in qualsiasi sprint successivo → interrompere e analizzare.

## Per Test Case

| TC  | F1   | Pre  | Rec  | TP | FP | FN | Note |
|-----|------|------|------|----|----|----|------|
| TC01| 0.57 | 1.00 | 0.40 |  2 |  0 |  3 | Stop+ripresa con date esplicite |
| TC02| 0.89 | 1.00 | 0.80 |  4 |  0 |  1 | Switch biologico |
| TC03| 0.86 | 1.00 | 0.75 |  3 |  0 |  1 | Negazione sospensione |
| TC04| 0.86 | 1.00 | 0.75 |  3 |  0 |  1 | Narrativo senza date |
| TC05| 0.91 | 1.00 | 0.83 |  5 |  0 |  1 | Multiple sospensioni |
| TC06| 1.00 | 1.00 | 1.00 |  9 |  0 |  0 | AR stile abbreviato |
| TC07| 0.89 | 1.00 | 0.80 |  4 |  0 |  1 | SpA raccordo |
| TC08| 0.86 | 1.00 | 0.75 |  6 |  0 |  2 | LES |
| TC09| 0.22 | 1.00 | 0.13 |  1 |  0 |  7 | [!!!] Bullet list |
| TC10| 0.44 | 1.00 | 0.29 |  2 |  0 |  5 | [!!!] Switch impliciti |
| TC11| 0.89 | 1.00 | 0.80 |  4 |  0 |  1 | Vasculite ANCA |
| TC12| 0.83 | 1.00 | 0.71 |  5 |  0 |  2 | AR 3 biologici |
| TC13| 0.89 | 1.00 | 0.80 |  4 |  0 |  1 | AR biosimilare |
| TC14| 0.92 | 1.00 | 0.86 |  6 |  0 |  1 | SSc terapia vascolare |
| TC15| 0.80 | 1.00 | 0.67 |  4 |  0 |  2 | AR raccordo vago |

## Obiettivo Sprint 2

Recall > 0.75, Precision > 0.95 (FP ≤ ~4)
