---
name: Steroid tapering — tablet representation preference
description: How calculateTablets chooses tablet schemes for the steroid tapering generator, and why it is scoped/limited the way it is.
---

# Steroid tapering — rappresentazione in compresse

`calculateTablets(dose, drugKey)` in `frontend/src/lib/steroidTapering.js` decide come rappresentare una dose in compresse. Regola di preferenza per Prednisone/Deltacortene (formati 25 e 5 mg):
- dose = quarto pulito della 25 (6.25/12.5/18.75/25) → UNA frazione/intero della 25 (¼/½/¾/1 cp da 25);
- altrimenti → cp da 5 mg (interi + eventuale ½);
- gating tramite flag `fractionableLarge: true`, impostato SOLO su `prednisone`.

**Why:** la preferenza è clinica, non matematica. L'algoritmo greedy originale massimizzava il numero di compresse piccole e produceva schemi assurdi (es. 18.75 → "3 cp da 5 + ¾ cp da 5" = 3,75 cp). Priorità volute: dose corretta → semplicità → meno compresse → frazioni pratiche (½/¼/¾) → niente schemi illeggibili.

**How to apply:**
- Modificare solo la RAPPRESENTAZIONE (`calculateTablets` + `formatPatientSchedule`); MAI il calcolo dose/date (sono problemi separati, esplicitamente disaccoppiati).
- Le dosi non-quarto (es. 17.5/22.5) usano di proposito più cp da 5 mg anche se una combinazione con frazione di 25 avrebbe meno pezzi: è una scelta accettata, non un bug — non "ottimizzare" senza conferma clinica. L'eventuale evoluzione è un chooser a punteggio, non altri casi speciali.
- metilprednisolone/deflazacort/brucorten NON hanno `fractionableLarge` → comportamento invariato (greedy su interi grandi→piccoli + una frazione della più piccola). Non aggiungere il flag senza richiesta.
