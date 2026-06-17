---
name: TERAPIE PREGRESSE non ha un header dedicato (gap di segmentazione)
description: Why a "TERAPIE PREGRESSE"/"TERAPIE SOSPESE" block in a referto leaks past drugs into the home-therapy scope during visit import.
---

`letterSectionParser.js` non ha un header per le terapie pregresse/sospese. La regex
di `TERAPIA_DOMICILIARE` contiene l'alternativa nuda `TERAPIE\b`, quindi una riga
`TERAPIE PREGRESSE:` matcha come TERAPIA_DOMICILIARE e il corpo
("…Plaquenil sospeso per mialgie") finisce nello scope domiciliare (`_domScope`).

**Conseguenza:** nel flusso import-lettera (`parseVisitText`) i farmaci pregressi di
un blocco etichettato "TERAPIE PREGRESSE" NON vengono instradati come
historical_exposure. Vengono visti da `extractTherapies` come terapia domiciliare;
sopravvivono solo se `PAST_AFTER_RE` (es. "sospeso per") scatta sul contesto dopo il
farmaco — altrimenti restano "active". `parseHistoricalTherapies`
(historicalTherapyParser.js) NON è chiamato da `parseVisitText` (solo dal flusso
prima-visita / ConcomitantTherapyReview).

**Why:** è una causa concreta del bug "terapie pregresse mostrate come attive/invariate"
e della contaminazione di `terapia_domiciliare`/`home_therapies_text`.

**How to apply:** se si aggiunge un header dedicato (TERAPIE PREGRESSE/SOSPESE/STORICHE,
EX TERAPIE), metterlo PRIMA di TERAPIA_DOMICILIARE nell'ordine di match e instradarlo a
uno scope storico (non `_domScope`/`_indScope`); evitare che `TERAPIE\b` nudo catturi
"TERAPIE PREGRESSE". Verificare anche `INLINE_HEADER_SPLIT_RE`.
