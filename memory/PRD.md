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

## Implemented (2026-02-10 - v8)
- [x] **Criteri ACR/EULAR 2023 APS** (Barbhaiya): 8 domini (D1-D6 clinici + D7-D8 lab),
  entry criterion + scoring stratificato per profilo di rischio. Aggiunto a
  CRITERIA_GROUPS (APS) e a CRITERIA_DIAGNOSIS_MAP per auto-aggiornamento diagnosi.
- [x] **Linee Guida EULAR 2019 APS** (Tektonidou): profilassi primaria, trombotica
  venosa/arteriosa, CAPS, ostetrica + monito DOAC.
- [x] **Linee Guida EULAR 2024 update Gravidanza & RMD** (Andreoli/Russell):
  principi, pre-concepimento, gravidanza, allattamento, esposizione paterna,
  vaccinazioni.
- [x] **Tabella farmaci BSR 2022** in gravidanza/allattamento: 7 sezioni
  (compatibili/condizionali/da evitare in gravidanza, compatibili/da evitare
  in allattamento, esposizione paterna, vaccinazioni). Con link al full text PMC.
- [x] **Auto-suggestion** per diagnosi "antifosfolipidi/APS" → suggerisce
  criteri ACR/EULAR 2023 APS.
- [x] **Dashboard pinning aggiornato**: aggiunti criteri APS e linee guida
  Gravidanza/APS con badge colorati (rosa per Gravidanza, viola per APS).

## Implemented (2026-02-10 - v7)
- [x] **Linee Guida ACR/EULAR/ERS**: nuova pagina `/linee-guida` con 12
  documenti di sintesi (ILD ERS-EULAR/ACR 2023 in evidenza, AR 2022, AP 2023,
  axSpA 2022, LES 2023, SSc 2023, AAV 2022, Sjögren 2019, gotta 2020,
  PMR 2015, Behçet 2018, fibromialgia 2016). Filtri per malattia, ricerca
  testuale, dialog con sezioni numerate e bullet points.
- [x] **Voce di navigazione "Linee Guida"** in sidebar (Layout.jsx) +
  rotta in App.js
- [x] **Dashboard widget redesign**: spotlight ILD prominente in alto +
  due card affiancate "Criteri Classificativi" (6 criteri pinnati) e
  "Linee Guida ACR/EULAR/ERS" (4 linee pinnate con badge ILD). I criteri
  pinnati linkano direttamente al criterio aperto via URL `?open=...`.

## Implemented (2026-02-10 - v6)
- [x] **Sezione Esami di laboratorio** completa con 6 pannelli predefiniti:
  Autoanticorpi (29 test), Complemento (3), Fase acuta (5), Emocromo (7),
  Funzione organi (10), Urine (6); supporta valori numerici, qualitativi
  (positivo/negativo/borderline) e testuali (titolo ANA, pattern). Backend
  CRUD `/api/lab-exams` + UI con accordion per pannello + storico in linea
  + evidenziazione automatica fuori range (↑ rosso / ↓ blu)
- [x] **Reminder/notifiche follow-up**: nuovo modello backend, endpoint
  `/api/reminders` + `/api/reminders/upcoming`. Per paziente: aggiungi
  reminder con tipo (visita controllo/lab/imaging/terapia/capillaroscopia),
  data, note. Quick presets +1/3/6/12 mesi. Badge urgenza (Scaduto rosso /
  ≤7gg arancione / ≤30gg blu). Dashboard mostra widget "Prossimi reminder"
  + StatCard "Reminder attivi" con highlight rosso se ci sono scaduti
- [x] **Audit "creato da"**: tutti i modelli (Patient/Assessment/
  CriteriaEvaluation/Therapy/LabExam/Reminder) salvano `created_by_name`
  al momento della creazione. Visualizzato come badge:
  - Tabella valutazioni: "da Dr. Rossi" sotto la data
  - Card terapia: "prescritto da Dr. Rossi"
  - Esami: "Dr. Rossi" con icona utente
  - Reminder: "Dr. Rossi" nella riga
  - Dashboard valutazioni recenti: mostra il medico
- [x] **Fix login**: cookie ora con `Secure=True; SameSite=None` per
  funzionare in ambiente HTTPS (precedentemente Lax + non-Secure causava
  blocco dei cookie sui browser moderni)

## Implemented (2026-02-10 - v5)
- [x] **Multi-utente con autenticazione JWT** + organizzazioni (UO):
  - Backend: bcrypt password hash, JWT in httpOnly cookie, /api/auth/*
    (register, login, logout, me, refresh)
  - Registrazione: crea nuova UO (admin) o unisciti via codice invito
  - Tutti i pazienti, valutazioni, criteri e terapie sono tagged
    organization_id; isolation a livello di UO (medici della stessa UO
    vedono gli stessi pazienti)
  - Migrazione automatica dati esistenti alla "UO Reumatologia" di default
  - Sidebar con info UO + codice invito copiabile + menu utente con logout
- [x] **Modulo Terapia** per ogni paziente:
  - Backend: POST/GET/PUT/DELETE /api/therapies (organization-scoped)
  - 13 schede terapeutiche per malattia (AR, AP, SpA, LES, Sjögren,
    Vasculiti ANCA, Miositi, Fibromialgia, SSc, Gotta, PMR, Behçet, IgG4-RD)
    con farmaci e posologia tipica, suggerimenti automatici da diagnosi
  - CRUD completo: drug_name, categoria (csDMARD/bDMARD/tsDMARD/GC/FANS/
    analgesico/sintomatica), dose, frequenza, via, date inizio/fine,
    stato (active/discontinued/completed), motivo sospensione, note
  - Sezioni separate per terapie in corso vs precedenti
- [x] **Auto-aggiornamento diagnosi** al salvataggio criteri: dialog di
  conferma se i criteri sono soddisfatti e la diagnosi attuale differisce
- [x] **Confronto side-by-side homunculus**: nel form valutazione DAS28-type
  l'omino della visita corrente (modificabile) e l'omino della visita
  precedente (read-only) sono mostrati uno sotto l'altro con conta TJC/SJC
  separate per confronto immediato
- [x] **Correzione VEDOSS**: rimosso "ANA generico" (non specifico per SSc).
  Solo Raynaud (obbligatorio) + ≥1 marker SSc-specifico (puffy fingers, ACA,
  anti-Scl70, anti-RNAP III, capillaroscopia con pattern sclerodermico)
- [x] **Correzione Capillaroscopia**: score semi-quantitativo basato sul
  pattern Cutolo (Normale=0, Aspecifico=0, Early=1, Active=2, Late=3).
  Features descrittive non sommano punti
- [x] Test credentials in `/app/memory/test_credentials.md`
  (admin@clinimetria.it / admin123 / UO Reumatologia)

## Implemented (2026-02-10 - v4)
- [x] EULAR Response calcolata automaticamente tra valutazioni successive
  di DAS28-ESR/CRP (Buona/Moderata/Nessuna) e CDAI/SDAI (≥85% / ≥50% / ≥20%)
  con badge colorato nello storico
- [x] Modifica valutazioni esistenti: bottone Edit + form precompilato
  (PUT /api/assessments/{id}); supporta tutti gli indici inclusi homunculus
  e mappe complesse (PASI, PASI, mRSS, FIQR, ecc.)
- [x] Tutti i nuovi indici (mRSS, Schöber, Capillaroscopia) sono già nel
  filtro del grafico andamento (lookup da INDEX_LABELS)
- [x] Export PDF dei criteri classificativi (`exportCriteriaPDF`):
  anagrafica + tabella sintetica + dettaglio voce per voce per ogni criterio
- [x] **mRSS Homunculus**: SVG con 17 regioni cliccabili (volto, torace,
  addome, braccia, avambracci, mani, dita, cosce, gambe, piedi); click
  cicla 0→1→2→3 con codifica colore (grigio/giallo/arancione/rosso) e
  numero in sovraimpressione; totale calcolato in tempo reale
- [x] **Criteri VEDOSS** (Avouac/EUSTAR 2011): Raynaud + dita gonfie +
  ≥1 marker (ANA, ACA, anti-Scl70, anti-RNAP III, capillaroscopia SSc)

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
