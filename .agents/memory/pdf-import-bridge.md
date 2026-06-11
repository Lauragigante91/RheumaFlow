---
name: PDF import thin bridge + de-identificazione
description: Architettura del bridge PDF→testo e vincolo privacy sulla de-identificazione pre-parser
---

## Regola architetturale

**Il rawText estratto dal PDF non deve MAI entrare nello stato React né essere
passato a qualsiasi funzione downstream.**

`stripDemographics(rawText)` viene chiamato immediatamente dopo `extractTextFromPdf()`,
prima di qualsiasi `setState`, log, display, chiamata API o pipeline clinica.
Solo `cleanText` viene salvato nello stato del componente.

**Why:** I PDF clinici italiani contengono dati anagrafici del paziente (nome, CF,
DOB, residenza, email) che non devono propagarsi nell'archivio clinico. Il
collegamento al paziente avviene tramite `patient_id` interno, mai leggendo
l'identità dal PDF.

## Architettura del bridge

```
PDF file
  → extractTextFromPdf() [pdfLabExtractor.js, 100% browser, pdfjs-dist]
  → rawText (locale, mai salvato)
  → stripDemographics(rawText) [pdfDeidentifier.js]
  → { cleanText, removedCount, sectionsFound }
  → ImportVisitPdfModal stato: extractedText = cleanText ONLY
  → onTextExtracted({ text: cleanText, detectedDate })
  → PatientDetail: setImportPdfInitialText(cleanText), apre ImportVisitFromTextModal
  → ImportVisitFromTextModal: initialText prop → pre-compila textarea
  → handleAnalyse() → visitTextParser.js pipeline completa
```

## pdfDeidentifier.js — cosa rimuove

Pattern applicati in ordine:
1. **CF regex** `[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]` — cattura anche CF del medico nella firma digitale e omocodia
2. **Email regex** — cattura sia email pazienti sia email istituzionali nei referti AUSL
3. **Campi labeled inline** (replace nella riga, non intera riga perché il layout pdfjs può mescolare sidebar e contenuto):
   - `Cognome:`, `Nome:` (solo ALL-CAPS — formato form)
   - `Nato\a:` + `il:` + `Età:` (blocco DOB intero, poi fallback parziale)
   - `Codice Fiscale:`, `C.F.:`
   - `Scheda Nr.:` (numero cartella admin — mantiene la data "del:")
   - `Indirizzo:`, `Residenza:`, `Tel:`, `Cell:`
   - `Medico curante:`, `MMG:`
   - `Tessera:`, `NRE:`, `NRO:`
4. **NON tocca**: età in prosa clinica ("paziente di 21 anni"), date cliniche (EE 13/03/26), nomi medici/strutture

## Test de-identificazione — referto AUSL Bologna (valori qui SINTETICI)

Caso reale con layout: sidebar equipe medica a sinistra + contenuto clinico a
destra, entrambi mescolati nell'estrazione pdfjs (coordinate-based). I valori
sotto sono placeholder sintetici a scopo illustrativo (mai PII reale in memoria).

Risultato stripDemographics: 9 elementi rimossi (per categoria):
- Cognome (campo form ALL-CAPS) — es. `ROSSI` ✓
- Nome (campo form ALL-CAPS) — es. `MARIO` ✓
- CF paziente (CF regex + label) — formato `RSSMRA80A01H501U` ✓
- CF medico in firma digitale (CF regex) — stesso formato ✓
- DOB (DOB block) — es. `01/01/1980` ✓
- email istituzionale AUSL #1 (email regex) — es. `reparto@esempio.it` ✓
- email istituzionale AUSL #2 (email regex) ✓
- Scheda Nr. (numero cartella admin) ✓
- label "Codice Fiscale:" residua dopo CF regex ✓

12 sezioni cliniche riconosciute: raccordo, terapia_domiciliare, esami_pregressi, anamnesi_fisiologica, anamnesi_familiare, anamnesi_intervallare, visita_odierna, comorbidita, allergie, conclusioni, indicazioni, ho_richiesto

"Paziente di 21 anni" preservato ✓ (prosa clinica, non campo demografico)

## File coinvolti

- `frontend/src/lib/pdfDeidentifier.js` — nuovo modulo de-identificazione
- `frontend/src/lib/pdfLabExtractor.js` — estrattore PDF (invariato)
- `frontend/src/components/visits/ImportVisitPdfModal.jsx` — bridge thin
- `frontend/src/components/visits/ImportVisitFromTextModal.jsx` — destinazione (prop initialText/initialDate)
- `frontend/src/pages/PatientDetail.jsx` — wiring onTextExtracted

## Componenti ora ridondanti (futura pulizia)

- Backend endpoint `/parse-pdf-visit` (Python) — non più chiamato
