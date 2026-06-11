---
name: Hb (sangue) svuotata da "emoglobina" urinaria
description: collisione di lemma sangue/urine nel parser lab — l'emoglobina urinaria qualitativa pre-empta la chiave hb numerica dell'emocromo
---

Un PARAM numerico dell'emocromo (es. `hb`, alias nudo `emoglobina`) viene intercettato dalla fase
qualitativa generica dell'estrattore quando nel testo compare l'emoglobina urinaria qualitativa
("emoglobina assente/negativa/nn"). Quel match crea un risultato con la STESSA key del parametro
ematico (`hb`); la key entra in `qualKeys` e la fase numerica (che gira sempre DOPO quella
qualitativa) salta il vero valore dell'emocromo → campo vuoto. Esistono matcher urine dedicati
(`hb_qual`, `hemoglobinuria`) con key distinte proprio per evitare questa collisione.

Fix applicata: escluso `hb` dal loop qualitativo generico dei PARAMS, così l'emoglobina urinaria resta
gestita solo da `hb_qual`/`hemoglobinuria` senza consumare la key `hb`. Regressioni: LAB-HB-1..4.

RISCHIO RESIDUO (non ancora risolto): `wbc` ha la collisione IDENTICA — "leucociti negativi" (urine
dipstick, plurale coperto da negativ[oaie]) fa scartare il WBC numerico dell'emocromo. `plt` stesso
meccanismo, rischio clinico minore. Nota asimmetria: QUAL_NORM_RE copre "assente" (singolare) ma non
"assenti" (plurale), quindi alcuni casi sfuggono per asimmetria del pattern, non per design.

**Why:** sangue e urine condividono lo stesso lemma; la fase qualitativa precede sempre la numerica,
quindi l'ordine nel testo non conta.

**How to apply:** quando un PARAM numerico emocromo condivide un lemma con un parametro urinario
qualitativo, escluderlo dal loop qualitativo generico (o context-gating dell'alias nudo).

Privacy: il testo OCR del LabImportFromImageDialog e' Tesseract.js in-browser, vive solo nello state
`ocrText` e NON e' persistito (LabExamBase ha solo `source_filename`); non recuperabile dal DB.
