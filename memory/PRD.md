# Clinimetria Reumatologica - PRD

## Problem Statement
"Costruiscimi un'applicazione per fare le clinimetrie nelle malattie reumatiche"

User requirements:
- Tutti gli indici principali (DAS28-ESR, DAS28-CRP, CDAI, SDAI, BASDAI, ASDAS-CRP, DAPSA, SLEDAI-2K, HAQ, PASI)
- Omino interattivo per conta articolare (tender/swollen)
- PASI con mappa regioni corporee
- Singolo utente con anagrafica pazienti e storico valutazioni
- Export PDF/CSV dei report
- Interfaccia in italiano

## Architecture
- **Backend**: FastAPI + Motor/MongoDB. Endpoints `/api/patients` (CRUD) + `/api/assessments` (create/list/delete) + `/api/stats`. UUID string IDs, _id excluded from all responses.
- **Frontend**: React 19 + React Router + Tailwind + Shadcn UI. Recharts per grafici andamento. jsPDF + jspdf-autotable per export PDF. Custom CSV export. Tutto in italiano.
- **Homunculus**: Custom SVG con ~60 joints. Click cicla tra: none → tender (blu) → swollen (rosso) → both (viola).
- **Formule cliniche**: implementate in `/app/frontend/src/lib/clinimetrics.js` (calcolo real-time lato client).

## User Personas
- Medico reumatologo che valuta pazienti in ambulatorio e necessita di calcoli rapidi, storico e report esportabili.

## Core Requirements (Static)
- Anagrafica pazienti (CRUD)
- 10 calcolatori clinimetrici con interpretazione automatica
- Conta articolare interattiva (28 joints DAS28, 66/68 DAPSA)
- PASI con 4 regioni corporee (capo, arti superiori, tronco, arti inferiori)
- Storico valutazioni per paziente
- Grafici andamento nel tempo
- Export PDF + CSV

## Implemented (2026-02-10)
- [x] Backend CRUD pazienti e valutazioni con cascade delete
- [x] Endpoint /api/stats per dashboard
- [x] Dashboard con stats e valutazioni recenti
- [x] Anagrafica pazienti con ricerca, dialog creazione/modifica
- [x] Patient detail con storico + grafico andamento + filtro per indice
- [x] Homunculus SVG interattivo (28 e 66/68 modalità)
- [x] 10 calcolatori: DAS28-ESR, DAS28-CRP, CDAI, SDAI, BASDAI, ASDAS-CRP, DAPSA, SLEDAI-2K, HAQ, PASI
- [x] PASI con selettori E/I/D/A per 4 regioni
- [x] Export PDF completo (anagrafica + storico + dettaglio per valutazione)
- [x] Export CSV
- [x] UI in italiano

## Implemented (2026-02-10 - v3)
- [x] Date picker italiano (dd/mm/yyyy) con shadcn Calendar + locale `it`,
  applicato a data nascita paziente e data valutazione
- [x] Nuovi tool per Sclerosi Sistemica: **mRSS** (17 aree 0-3, max 51),
  **Capillaroscopia** (pattern Cutolo + features qualitative),
  **Test di Schöber** modificato (distanza eretta vs flessione)
- [x] Suggerimenti automatici basati sulla diagnosi:
  card dedicata in patient detail + sezione "Consigliati" in cima al dropdown
  Nuova Valutazione (matching keywords: AR, AP, SpA, LES, Sjögren, Vasculiti,
  Miositi, Fibromialgia, SSc, Gotta, PMR, Behçet, IgG4-RD, AOSD, Psoriasi)
- [x] Backend: nuovi endpoint `POST/GET/DELETE /api/criteria-evaluations`
  con cascade delete dal paziente
- [x] Storico criteri classificativi nella scheda paziente con score, soglia,
  esito (Soddisfatti/Non raggiunti) e azione di delete
- [x] Salvataggio criteri da pagina Criteri: selezione paziente + data + bottone
  "Salva nel paziente". Pre-apertura criterio via URL `?paziente=x&open=y`
- [x] Nuovi indici: BASFI, BASMI lineare, ESSDAI, ESSPRI, BVAS v3, MMT-8 (range 0-150 corretto), FIQR
- [x] Pagina Criteri Classificativi con 14 criteri interattivi:
  - ACR/EULAR 2010 AR, CASPAR AP, ASAS axSpA, IBP ASAS, ACR/EULAR 2019 LES,
    ACR/EULAR 2016 Sjögren, ACR/EULAR 2013 SSc, ACR/EULAR 2015 Gotta,
    ACR/EULAR 2012 PMR, ACR/EULAR 2022 GPA/MPA/EGPA, Yamaguchi AOSD,
    ACR/EULAR 2017 Miositi, ACR 2016 Fibromialgia, ICBD 2014 Behçet,
    ACR/EULAR 2019 IgG4-RD
- [x] Importa clinimetria precedente: pulsante "Importa precedente" nel form
  valutazione che pre-popola lo stato dell'omino con la conta articolare
  dell'ultima valutazione dello stesso indice (per confronto visivo)
- [x] Diagnosi paziente già salvata in anagrafica (campo persistente)

## Backlog (Prioritized)
### P1
- [ ] Date picker con locale it-IT (attualmente browser-native mm/dd/yyyy)
- [ ] Modifica valutazioni esistenti (attualmente solo create/delete)
- [ ] Filtri e ordinamento storico valutazioni
- [ ] DialogDescription per a11y WCAG

### P2
- [ ] Multi-user con autenticazione (JWT o Google Emergent Auth)
- [ ] Vista "omino" anche per BASDAI/ASDAS regioni assiali
- [ ] EULAR Response Criteria (risposta buona/moderata/nessuna)
- [ ] Template referti stampabili personalizzati
- [ ] Backup/restore database
- [ ] Ricerca avanzata e filtri su pazienti (età, diagnosi, score range)

## Next Tasks
- Raccogliere feedback utente sull'usabilità dell'omino e sui calcolatori
- Aggiungere date picker italiano se necessario per UX clinica
