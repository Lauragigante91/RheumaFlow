---
name: AUSL Bologna autoantibody extraction quirks
description: 3 pattern-mismatch bug fixes for FR/ACPA/ANA in AUSL Bologna lab reports
---

## FR (Fattore Reumatoide) — valore `< N`

AUSL Bologna emette "Fattore Reumatoide < 10 U/mL". La regex AUTOAB_NUMERIC
originale usava `[:\\s=]*` prima della cattura numerica — non consumava il `<`.

**Fix**: `[:\\s=]*[<>]?\s*(\d+...)` nel ciclo AUTOAB_NUMERIC (riga ~1313).

## ACPA — alias "anti citrullina" mancante

AUSL Bologna scrive "Anticorpi anti citrullina IgG" (non "anti-CCP" né "ACPA").
Alias originali: solo `ACPA`, `anti.?CCP`. Nessun match.

**Fix**: aggiunto `anti.?citrullina(?:\\s+IgG)?` sia in AUTOAB_QUAL che AUTOAB_NUMERIC.

## ANA — formato multiriga + titer `<1:80`

AUSL Bologna usa:
```
Anticorpi anti Nucleo (ANA) - Reflex
Titolo                  <1:80
```
"ANA" sulla riga header, "Titolo <1:80" sulla riga successiva.
Il titer ha prefisso `<` (= sotto soglia, negativo per IFA HEp-2).

**Fix in extractAutoantibodies**:
1. `parseAnaTiter(rawTiter)`: `<1:80`→negative, `1:80`→borderline, `≥1:160`→positive.
2. Case A (stessa riga): regex aggiornata a `(<?\d+:\d+)`.
3. Case B (multiriga, AUSL): `/\bANA\b[^\n]*\n[^\n]*?titolo[^\n]*?(<?\d+:\d+)/gi`.

**Why**: L'IFA HEp-2 (metodica AUSL) esprime il titolo ANA come diluizione
con prefisso `<` quando sotto soglia. Serve status semantico, non solo il numero.
