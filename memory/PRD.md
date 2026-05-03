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

## Implemented (2026-02-10 - v15)
- [x] **Timeline clinimetrica con terapie in corso** in PatientDetail:
  - Toggle "Mostra terapie" (flaggabile/deflaggabile) sopra il grafico.
  - Sotto ogni punto della linea vengono visualizzati pallini colorati
    corrispondenti alle categorie di terapia attive a quella data
    (csDMARD, bDMARD, tsDMARD, glucocorticoide, FANS, analgesico).
  - Tooltip arricchito al hover: data, score, indice e lista completa
    delle terapie attive con dosi e colori di categoria.
  - Legenda sotto il grafico con chiavi colore delle categorie
    effettivamente presenti nel dataset.
  - Calcolo automatico delle terapie attive basato su start_date/end_date.

## Implemented (2026-02-10 - v14)
- [x] **FIX VEDOSS**: ristrutturato a 2 livelli secondo EUSTAR ufficiale.
  LIVELLO 1 (3 red flags obbligatori: Raynaud + ANA + Puffy fingers).
  LIVELLO 2 (≥1 marker specifico: ACA / Scl-70 / RNAP3 / capillaroscopia
  sclerodermica).
- [x] **EULAR 2025 Artrite Reumatoide update** (Smolen): 5 principi + 9
  raccomandazioni, focus su sicurezza JAKi, biosimilari, tapering.
- [x] **EULAR 2025 Behçet update**: 5 principi + 12 raccomandazioni per
  organo (mucocutaneo, oculare, vascolare, neurologico, GI); TNFα
  monoclonali precocemente in vascolare/neurologico, infliximab in uveite.
- [x] **ERS/EULAR 2025 CTD-ILD** (clinical practice guideline,
  DOI 10.1016/j.ard.2025.08.021): screening, diagnosi, stratificazione,
  terapia per SSc/miositi/AR-ILD, PPF trasversale, nintedanib esteso.
- [x] **EULAR 2019 Vaccinazioni** (Furer): 6 principi + 9 raccomandazioni
  su influenza, pneumococco, HPV, Shingrix, COVID-19, vivi attenuati,
  rituximab, gravidanza e conviventi.
- [x] **ACR/AAHKS 2022 Perioperatorio** (Goodman): gestione DMARDs/
  biologici/JAKi/GC per artroplastica elettiva THA/TKA + LES specifici.
- [x] Dashboard: nuovi badge "Vaccini" (azzurro), "Perioperatorio"
  (arancione), "2025" (verde). ILD spotlight ora preferisce la 2025.

## Implemented (2026-02-10 - v13)
- [x] **GDPR-safe Mode - Pseudonimizzazione forte** per ridurre gli obblighi
  privacy ed eliminare la necessità di firma consenso del paziente.
  Backend: campo `pseudonymized_mode` su Organization, campo `codice_paziente`
  (unique per org) e `anno_nascita` su Patient, nome/cognome ora opzionali.
  Endpoint: `PUT /api/organization/settings` (solo admin),
  `POST /api/patients/{id}/anonymize` (rimuove nome/cognome/CF/data_nascita,
  genera codice PZ-xxxxx se mancante, deriva anno da data_nascita se presente).
- [x] **Pagina Privacy / GDPR** (`/privacy`) in sidebar con:
  - Toggle modalità pseudonimizzata (admin only) con descrizione legale
  - Download PDF Informativa privacy (Art. 13 GDPR) precompilata con nome UO
  - Download PDF Registro dei trattamenti (Art. 30 GDPR)
  - Download PDF Etichette "corrispondenza codice↔identità" per fascicolo cartaceo
- [x] **Form paziente pseudonymization-aware**: se modalità attiva,
  l'UI mostra solo codice_paziente (obbligatorio) + anno_nascita + sesso +
  diagnosi + note; altrimenti mostra anche nome/cognome/CF/data_nascita.
- [x] **Pulsante Anonimizza** in PatientDetail (mostrato solo se il paziente
  ha ancora dati identificativi) con conferma e feedback toast.
- [x] Tabella pazienti: in modalità pseudonimizzata mostra CODICE ed ETÀ
  (calcolata da anno_nascita), altrimenti Cognome/Nome + data nascita + codice
  come secondary.
- [x] AuthContext/auth/me: espone `pseudonymized_mode` al frontend.

## Implemented (2026-02-10 - v12)
- [x] **Sezione "Miscellanea"** in sidebar con icona FlaskConical, tabelle sinottiche e algoritmi diagnostici.
- [x] **Tabella Anticorpi miosite-specifici**: 13 MSAs con fenotipo + coinvolgimento muscolo/cute/polmone/cuore/GI/tumore
  (Jo-1, PL-7, PL-12, EJ, OJ, Mi-2, TIF1-γ, NXP2, MDA5, SAE, SRP, HMGCR, cN1A).
- [x] **Tabella Malattie autoinfiammatorie**: 13 malattie (FMF, TRAPS, HIDS/MKD, CAPS FCAS/MWS/NOMID, PFAPA,
  AOSD, Behçet, Schnitzler, DIRA, PAPA, VEXAS) con esordio, febbre, pattern, red flag e genetica.
- [x] **Tabella Pattern ANA**: omogeneo, speckled, nucleolare, centromerico, nuclear dots, citoplasmatico, NuMA +
  anticorpi associati + malattie.
- [x] **7 iter diagnostici** con step numerati:
  - iperCKemia (conferma, clinica, esami, screening autoimmune, strumentali, DD, red flags)
  - Aftosi orale ricorrente (caratterizzazione, cause locali, nutrizionali, autoimmuni, GI, DD, Behçet)
  - Eritema nodoso (conferma, cause, esami, Löfgren, terapia)
  - Raynaud primario vs secondario (Allen-Brown, red flags, cause, terapia)
  - Iperferritinemia reumatologica (soglie, cause, HLH, H-score, MAS)
  - Uveite (classificazione SUN, spondiloartriti, JIA, sarcoidosi, Behçet, terapia)
  - Dolore infiammatorio vs meccanico (IBP ASAS, pattern articolare)

## Implemented (2026-02-10 - v11)
- [x] **Filtri/ordinamento storico valutazioni** in PatientDetail:
  filtro per indice, range date (da/a), sort (data ↓/↑, score ↓/↑, indice A-Z),
  conteggio "X su Y".
- [x] **Ricerca avanzata pazienti** in Patients.jsx: ricerca testuale +
  filtri sesso, diagnosi (con dropdown + opzione "Senza diagnosi"),
  range età min/max, sort (Cognome A-Z/Z-A, più recenti/vecchi, età).
  Conteggio risultati. Pulsante "Pulisci filtri" se attivi.
- [x] **Export database** (Backend + Frontend):
  - GET `/api/export/json` → JSON completo (tutte le collezioni org-scoped)
  - GET `/api/export/csv-zip` → ZIP con 1 CSV per collezione + manifest.json
  - Menu utente in sidebar con sezione "BACKUP DATABASE" e due opzioni
    (Esporta JSON / Esporta CSV ZIP). Toast di conferma.
- [x] **AI - Importa da testo visita** (Claude Sonnet 4.5 via Emergent LLM key):
  - Backend: `POST /api/ai/parse-visit` con system prompt strutturato
    estrae anagrafica, indici clinimetrici, terapie, esami lab, profilo SSc.
  - Pulsante grande viola/fucsia "Importa da testo visita (AI)" in cima
    alla scheda paziente.
  - Dialog con textarea, esempio, pulsante "Estrai dati" → mostra preview
    strutturata con checkbox per selezionare cosa applicare.
  - Applicazione: aggiorna anagrafica, crea valutazioni/terapie/esami,
    fa upsert+merge del profilo SSc.
  - Gestione errore "Budget esaurito" con messaggio chiaro per top-up.
- [x] EMERGENT_LLM_KEY aggiunto a backend/.env; emergentintegrations già
  in requirements.txt.

## Implemented (2026-02-10 - v10)
- [x] **Profilo Sclerodermia per paziente**: nuova sezione visibile solo
  per pazienti con diagnosi SSc/sclerodermia/VEDOSS in PatientDetail.
  Backend: nuovo modello `ScleroProfile` + endpoints
  `GET/PUT /api/patients/{id}/sclero-profile` (upsert, 1 profilo per paziente).
  Frontend: `ScleroProfileSection.jsx` con 7 sezioni accordion:
  - Impegno cutaneo (subset sine/limited/diffuse, mRSS, sclerodattilia,
    puffy fingers, calcinosi, teleangectasie, microstomia)
  - Profilo anticorpale (ANA titolo+pattern, ACA, Scl-70, RNAP III,
    U3-RNP, Th/To, PM-Scl, Ku, U1-RNP, altri ENA con tri-state Neg/Borderline/Pos)
  - Impegno vascolare (Raynaud primario/secondario, ulcere digitali,
    pitting scars, gangrena, capillaroscopia Cutolo, crisi renale, terapia)
  - Impegno polmonare interstiziale (presenza/stabilità, pattern HRCT,
    estensione Goh-Wells, FVC%, DLCO%, 6MWT, terapia)
  - Ipertensione polmonare (status screening, PSAP eco, NT-proBNP, RHC
    mPAP/PCWP/PVR, classe OMS, terapia)
  - Impegno gastrointestinale (GERD, dismotilità esofagea, GAVE, SIBO,
    pseudo-ostruzione, malassorbimento, calo ponderale, terapia)
  - Impegno muscoloscheletrico (artralgie, sinovite, tendon friction
    rubs, contratture, acroosteolisi, miosite, CK, debolezza)
  - Note generali libere
  Audit "creato da" e "ultima modifica" tracciati. Cascade delete con paziente.

## Implemented (2026-02-10 - v9)
- [x] **Criteri ACR/EULAR 2022 GCA** (Ponte): entry obbligatori (età ≥50, imaging
  LVV, esclusi mimics) + criteri clinici + lab + imaging/istologia, soglia ≥6.
- [x] **Criteri ACR/EULAR 2022 Takayasu** (Grayson): entry obbligatori
  (età ≤60, imaging LVV) + clinici + territori arteriosi, soglia ≥5.
- [x] **Linee guida EULAR 2018 LVV** (Hellmich): diagnosi/induzione/monitoraggio
  GCA + Takayasu + procedure di rivascolarizzazione.
- [x] **Linee guida ACR/VF 2021 LVV** (Maz): 22 raccomandazioni GCA + 20 TAK,
  con focus su tocilizumab, MTX, sorveglianza imaging.
- [x] Auto-suggestion per diagnosi "GCA/Horton/Takayasu" → suggerisce
  automaticamente i criteri 2022.
- [x] Aggiunto gruppo "Vasculiti grandi vasi" a CRITERIA_GROUPS e
  GUIDELINE_GROUPS; badge "LVV" rosa nelle pinned guidelines.

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
