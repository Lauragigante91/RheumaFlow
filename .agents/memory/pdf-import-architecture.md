---
name: PDF import architecture
description: Come funziona il bridge PDF → testo → parser clinico in RheumaFlow
---

# PDF Import Architecture

## Pipeline completa
1. `ImportVisitPdfModal` — estrae testo via `pdfLabExtractor.js` (pdfjs-dist v5, browser-only)
2. `pdfDeidentifier.stripDemographics()` — de-identifica + rimuove boilerplate istituzionale
3. `onTextExtracted({ text, detectedDate })` — handoff a PatientDetail
4. `ImportVisitFromTextModal` — stesso modal di "importa da lettera" con parser completo

## Entrambi i bottoni usano ImportVisitFromTextModal
- "Importa da lettera" → `setImportVisitOpen(true)` (initialText vuoto, utente incolla)
- "Importa da referto PDF" → `setImportPdfInitialText` + `setImportVisitOpen(true)` (testo pre-caricato)
- `VisitImportButton` non viene più usato per questi flussi

## Sidebar detection (pdfLabExtractor.js)
- Usa interval merging con `item.width` reale da pdfjs
- Cerca il primo gap > 0pt nella fascia [10%, 45%] della larghezza pagina
- Referto AUSL Bologna: spalla da x≈42pt a x≈157pt, corpo da x≈165pt → gap ≈ 8pt rilevato
- Fallback al testo grezzo se filteredWords < 60 o ratio < 0.30

## Boilerplate removal (pdfDeidentifier.js)
- `stripBoilerplate()` rimuove: intestazione istituzionale (ogni pagina), blocco admin, "IL MEDICO" + riga nome, footer legale
- "Data e ora di refertazione: DD/MM/YYYY" è PRESERVATA per date detection
- `detectVisitDate` cerca prima pattern esplicito "Data e ora di refertazione:" ovunque nel testo, poi prima data nei 800 char

**Why:** Il PDF AUSL Bologna ha spalla sinistra piena-pagina interleaved con corpo clinico nelle coordinate pdfjs; `item.width` è l'unico modo affidabile per trovare il confine tra colonne anche quando il gap tra left-edges è < 12pt.
