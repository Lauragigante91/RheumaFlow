---
name: PAST_AFTER_RE "sospeso nel ANNO per" non riconosciuto
description: Il gruppo opzionale (?:\d+\s+\w+\s+)?per\b consuma greedily "2024 per" (tratta "per" come \w+), lasciando nulla per il per\b richiesto finale.
---

## Regola

`PAST_AFTER_RE` in `visitTextParser.js`, ramo `sospeso nel/del/dopo`, deve usare `(?:\d+(?:\s+\w+)?\s+)?per\b` (la parola dopo il numero è opzionale).

**Pattern corretto:** `\bsosp(?:eso|esa)\s+(?:nel|del|dopo)\s+(?:\d+(?:\s+\w+)?\s+)?per\b`

**Why:** Il gruppo originale `(?:\d+\s+\w+\s+)?` richiede obbligatoriamente una parola (`\w+`) dopo il numero. Per "sospeso nel 2024 per X": `\d+` = "2024", `\w+` = "per", lasciando "X" per il `per\b` richiesto → NO MATCH. Il fix rende `\s+\w+` opzionale dentro il gruppo, coprendo sia "sospeso nel 2024 per X" (anno solo) sia "sospeso nel agosto 2024 per X" (mese + anno).

**How to apply:** Se si modifica `PAST_AFTER_RE`, verificare che i regression test `sosp_meta_anno` (usa `\s+a\s+\S+` branch) restino verdi e che "sospeso nel ANNO per" sia coperto. La stessa regex è usata sia da `extractTherapies` (linea ~550) sia da `applyNarrativeDiscontinuations` (linea ~662).
