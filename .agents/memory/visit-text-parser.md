---
name: Visit text parser (local, free)
description: Rule-based replacement for /ai/parse-visit Claude Haiku call; all client-side, zero cost.
---

# Visit text parser — parser locale gratuito

## Architettura

`frontend/src/lib/visitTextParser.js` — orchestratore principale (454 righe).

Dipende da tre parser già esistenti (non duplicare logica):
- `clinimetryTextParser.js` → `parseClinimetryFromText()` — score DAS28, CDAI, SDAI, HAQ, BASDAI, ASDAS, BASFI, BASMI, DAPSA, PASI, LEI, ESSDAI, ESSPRI, SLEDAI, BVAS, mRSS, FIQR
- `labValueExtractor.js` → `extractLabValues()` — CRP/VES/Hb/WBC/PLT/ALT/AST/CPK/Cr/eGFR/Vit D/TSH/acido urico/…
- `instrumentalParser.js` → `parseInstrumentalFindings()` — imaging (RM, Rx, TC, Eco, Capillaroscopia, …)

`visitTextParser.js` aggiunge:
- `extractTherapies()` — dizionario ~80 farmaci (csDMARD, bDMARD, JAKi, corticosteroidi, FANS, integratori, IPP, anti-gotta, bifosfonati)
- `extractPatientInfo()` — diagnosi + sesso da testo libero
- `extractScleroProfile()` — profilo SSc base (solo se "sclerodermia/SSc" presente nel testo)
- `interpretScore()` — soglie EULAR/ACR per tutti i principali indici
- `groupLabValuesToExams()` — raggruppa valori per pannello → formato lab_exams[] atteso da labExamsApi

## Shape restituito

Identico all'ex risposta di /ai/parse-visit:
```
{ extracted: { patient, assessments[], therapies[], lab_exams[], sclero_profile, instrumental_findings[], summary, criteria_flags } }
```

## Entry point nel componente

`VisitImportButton.jsx` chiama `parseVisitText(text)` (sincrono, no await).
Il componente è montato in `PatientQuickVisit.jsx`.

**Why:** l'utente vuole RheumaFlow completamente gratuito; la logica AI era l'unico costo residuo.

**How to apply:** se si aggiungono nuovi farmaci al dizionario, aggiungerli in `DRUG_PATTERNS` (array di triple `[RegExp, nome, categoria]`). Se si aggiungono nuovi indici clinimetrici, aggiungerli in `clinimetryTextParser.js` (non in visitTextParser).
