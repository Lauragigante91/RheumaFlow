---
name: Hb (sangue) svuotata da "emoglobina" urinaria
description: perché l'emoglobina dell'emocromo resta vuota quando il referto contiene anche un'emoglobina urinaria qualitativa
---

Il PARAM numerico `hb` (emocromo) ha tra gli alias la parola nuda `emoglobina`. La fase qualitativa
dell'estrattore (`extractQualitativeResults`, step 1) itera TUTTI i PARAMS e applica quell'alias a
qualsiasi `emoglobina <qualificatore>` nel testo — inclusa l'emoglobina urinaria del dipstick/sedimento
("emoglobina assente", "emoglobina negativa"). `makeQualResult` forza `key="hb"` etichettato "nella norma".
Quel risultato qualitativo mette `hb` in `qualKeys`; poi la fase numerica salta il PARAM se
`qualKeys.has(param.key)` → la vera "Emoglobina 14.2 g/dL" dell'emocromo viene scartata. Nel dialog
(`parseText` dedup-by-key tiene il primo e mostra `value`, che è null) il campo Hb appare VUOTO.

**Trigger**: il qualificatore urinario deve essere un token di `QUAL_NORM_RE` (assente, negativ*, nn,
nella norma, nei limiti, norm*). Con il solo trattino "-" NON scatta (il dash non è in QUAL_NORM_RE),
quindi in quel caso Hb numerica sopravvive. Esiste un `hb_qual` dedicato proprio per isolare l'emoglobina
urinaria, ma è inutile finché l'alias "emoglobina" del PARAM `hb` viene comunque consumato dalla fase
qualitativa generica.

**Why:** collisione di chiave canonica tra sangue e urine sullo stesso lemma "emoglobina"; la fase
qualitativa precede sempre quella numerica, quindi l'ordine nel testo non conta.

**How to apply:** quando un PARAM numerico dell'emocromo condivide un lemma con un parametro urinario
qualitativo, escludere quel PARAM dal loop qualitativo generico (o richiedere contesto/unità ematica),
altrimenti l'occorrenza urinaria pre-empta il valore ematico.

Nota privacy: il testo OCR del LabImportFromImageDialog è Tesseract.js in-browser, vive solo nello state
`ocrText` e NON è persistito (LabExamBase ha solo `source_filename`, nessun `source_text`); non è
recuperabile a posteriori dal DB.
