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

## Implemented (2026-02-10 - v16)
- [x] **Database farmaci con posologie standard** (`/app/frontend/src/lib/drugs.js`):
  oltre 35 farmaci reumatologici (csDMARDs, GC, TNFi, IL-6/17/23, IL-1, CD20,
  CTLA-4, JAKi, PDE4, antifibrotici, FANS, urico-abbassanti) con posologie
  stratificate per indicazione (RA, PsA, axSpA, SLE, SSc, AAV, GCA/TAK,
  Behçet, Sjögren, Uveite, IBD, PsO, HS, JIA, miositi, AOSD, CAPS/FMF, etc.).
- [x] **Form terapia upgraded**:
  - Dropdown "Farmaco" con lista completa + opzione "Altro (manuale)"
  - Campo "Indicazione" che compare SOLO se il farmaco ha >1 regimen;
    selezionando auto-compila dose/frequenza/via
  - Auto-fill della categoria in base al farmaco
  - Warning informativo per farmaci con dosaggi diversi per indicazione
    (es. Secukinumab) o con posologia uniforme (es. Upadacitinib 15 mg/die)
  - Mostra loading dose e note cliniche specifiche (es. MTX + folati,
    HCQ max 5 mg/kg/die retinopatia, target INR DOAC, etc.)

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

## Implemented (2026-05-06 - v32 - 3 nuovi criteri classificativi EULAR/ACR)
- [x] **Artropatia da emocromatosi (EULAR 2025)** — Kiely PDW et al., Ann
  Rheum Dis 2026;85(2):238-245. Primi criteri classificativi EULAR per HA.
  Requisiti di entry: omozigosi HFE C282Y + dolore articolare + sovraccarico
  di ferro. Score 0-11: età d'esordio (≤2pt), MCP/DIP/caviglia clinica (≤3pt),
  osteofiti uncinati MCP/caviglia (2pt) + radiografia DIP/caviglia (≤2pt),
  chirurgia anca/caviglia (2pt). Cutoff ≥5 con almeno 3 criteri positivi
  (sensibilità 71,4%, specificità 93,3%).
- [x] **Stratificazione rischio AR in fase di artralgia (EULAR/ACR 2025)** —
  van Steenbergen HW et al., modello CSA. NON diagnostica AR ma stratifica il
  rischio di sviluppare artrite/AR entro 12 mesi. Variabili: rigidità mattutina
  (≤4pt), tumefazione/difficoltà chiudere pugno (4-5pt), PCR (1pt), FR
  (negativo/basso/alto: 0-2-4pt), ACPA (negativo/basso/alto: 0-4-8pt), RMN
  opzionale (+4pt). Cutoff orientativo >10 punti = rischio elevato. AUC 0.80
  → 0.93 con RMN.
- [x] **Osteoartrosi della mano (EULAR 2023)** — Haugen IK, Kloppenburg M et
  al., Ann Rheum Dis 2024;83(11):1428-1435. Requisiti di entry: dolore/
  rigidità in articolazione target (DIP 2-5, PIP 2-5, IP1, CMC1) + esclusione
  di altre patologie. Score 0-15: età (0-3), rigidità mattutina (0-2),
  osteofiti radiografici (0-4), JSN (0-3), concordanza sintomi-struttura (0-3).
  Cutoff: ≥9 OA mano in generale, ≥8 OA interfalangea, ≥8 OA base pollice.
- [x] **Aggiunti 3 gruppi a CRITERIA_GROUPS**: "Artropatia da emocromatosi",
  "AR — fase a rischio", "Osteoartrosi" — visibili come filtri a chip nella
  pagina Criteri.


- [x] **ESSDAI completamente rifatto** con definizioni cliniche per ogni livello
  di ognuno dei 12 domini (basate sul paper Seror et al. EULAR 2010, Ann Rheum
  Dis). Ora ogni opzione mostra:
  - Etichetta (Assente/Lieve/Moderato/Alto)
  - **Descrizione clinica completa** (es. costituzionale Lieve = "Febbre lieve
    o intermittente 37,5–38,5 °C / sudorazioni notturne e/o calo ponderale del
    5–10%"; renale Alto = "Proteinuria >1,5 g/die OPPURE ematuria OPPURE GFR<60
    OPPURE GN proliferativa"; pulmonary Moderato = "ILD con NYHA II o 70% > DLCO
    ≥40% / 80% > FVC ≥60%"; ecc.)
  - Nota di contesto del dominio (es. "Esclude la febbre di origine infettiva")
  - Peso del dominio (×weight)
  - Card cliccabile su tutta l'area, ring blu sulla selezione corrente.
- [x] **SLEDAI-2K** (Bombardier 1992 / Gladman 2002): tutti i 24 item ora hanno
  descrizione clinica esplicativa sotto l'etichetta. Es. "Vasculite: Ulcerazioni,
  gangrena, noduli digitali dolorosi, infarti periungueali, livedo, vasculite
  documentata da biopsia/angiografia"; "Cefalea lupica: severa, persistente, di
  tipo emicranico, refrattaria agli analgesici narcotici"; "Anti-dsDNA aumentati:
  >25% rispetto al precedente o sopra il limite di normalità", ecc.
- [x] **BVAS v3** (Mukhtyar 2009): per ognuno dei 9 sistemi è ora visibile la
  riga "Voci tipiche:" che elenca le manifestazioni cliniche concrete da contare.
  Es. Generale = "Mialgie, artralgie/artrite, febbre ≥38°C, calo ponderale ≥2 kg";
  ORL = "Secrezione/ostruzione nasale, perdita uditiva, epistassi/croste,
  granulomi paranasali, stenosi subglottica"; Renale = "Ipertensione (PA
  diastolica >95 mmHg), proteinuria >1+, ematuria 1+, creatinina 125-249 /
  250-499 / ≥500 µmol/L, aumento creatinina >30%". Aiuta a ricordare quali
  manifestazioni rientrano in ogni sistema senza dover consultare la guida.


- [x] **ItalianDatePicker editabile**: il campo data accetta ora input testuale
  diretto in formato `gg/mm/aaaa` con auto-formattazione live (digitando "15032025"
  diventa "15/03/2025" automaticamente). Il calendario popup rimane disponibile
  via icona laterale come fallback. Validazione visuale (border rosso) se la
  data digitata non è valida. Maschera maxLength=10, modalità inputMode="numeric"
  su mobile per tastierino numerico. Funziona ovunque sia usato `ItalianDatePicker`
  (form pazienti, valutazioni, terapie, esami, reminders).
- [x] **Composite form PsA "AP — DAPSA + LEI + PASI"** (`mode="psa"`):
  - **DAPSA**: homunculus 66/68 con TJ68/SJ66, PCR (mg/dL), PGA (0-10), dolore
    paziente VAS (0-10) — tutti i campi richiesti dal calcolo DAPSA classico.
  - **LEI**: body chart entesite con i 6 siti cliccabili (Achille bilaterale,
    epicondilo laterale, condilo femorale mediale) + lista laterale sincronizzata
    "Doloroso/Non doloroso" con badge rosso/grigio.
  - **PASI**: 4 regioni cutanee (Capo, Arti superiori, Tronco, Arti inferiori)
    con input compatti per E/I/D (eritema/infiltrazione/desquamazione 0-4) e A
    (area % 0-6) per ognuna.
  - Card "Risultati in tempo reale" con i 3 punteggi (DAPSA + LEI + PASI),
    interpretazione live.
  - "Copia dalla visita precedente" supporta anche modalità PsA: ricostruisce
    joints da DAPSA + sites da LEI + regioni da PASI dell'ultima visita pivot.
  - Salvataggio: 3 assessment in parallelo (Promise.all). Toast: "3 valutazioni
    PsA salvate".
- [x] **Dropdown menu "Form unificati"** ora mostra "AP — DAPSA + LEI + PASI"
  per pazienti SpA/PsA (sopra "SpA — BASDAI + ASDAS + BASFI"). Test: paziente
  PsA con peripheral_involvement → DAPSA=12.8, LEI=2, PASI=1 calcolati live e
  salvabili insieme.


- [x] **Grafico clinimetrie multi-linea**: il chart "Andamento nel tempo" ora
  visualizza simultaneamente TUTTI gli indici clinimetrici del paziente con
  linee distinte. Ogni indice ha colore + dash pattern + dot shape unici dalla
  palette `INDEX_LINE_STYLE` (10 stili che ruotano: circle/square/diamond/triangle
  con varianti di tratteggio e colore). Tooltip mostra contemporaneamente tutti
  i punteggi della stessa visita. Chart wide format: chartData ha colonne
  `score_{index_type}` per ogni indice + metadati. Il dropdown "Tutti gli indici"
  funziona ancora per filtrare a un solo indice.
- [x] **Profili clinici spostati in cima alla pagina paziente**: tutti i profili
  malattia-specifici (RA, SpA/PsA, LES, AAV, Sjögren, Miositi, SSc) sono ora
  renderizzati subito dopo l'intestazione paziente e i suggerimenti diagnostici,
  prima di Therapy/Lab/Trend. Il "AavSummaryHeader" rimane in cima per le vasculiti.
  Layout ora: Header + Suggerimenti + AavSummary + **PROFILI** + (SpaJointsPanel)
  + Therapy + Exams + Reminders + Trend + History.
- [x] **Pannello "Impegno periferico — Quadro articolare ed entesitico"**
  (`SpaJointsPanel.jsx`): nuovo componente sempre visibile per pazienti SpA/PsA
  con `peripheral_involvement=true`. Mostra side-by-side:
  - Homunculus 66/68 (read-only) con l'ultimo stato articolare estratto dalla
    più recente valutazione DAPSA/DAS28/CDAI/SDAI (marker tender/swollen reali);
    contatori TJ totale e SJ totale + data e tipo della visita.
  - EnthesisBodyChart LEI (read-only) con i siti dolenti dall'ultima LEI;
    score LEI X/6 + interpretazione.
  Se non ci sono assessment, mostra placeholder informativo con suggerimento di
  creare una nuova valutazione DAPSA/LEI.


- [x] **Copia dalla visita precedente** nei form compositi AR e SpA: banner
  informativo in cima al dialog (azzurro prima, verde dopo conferma) che indica
  la data dell'ultima valutazione composita disponibile e un bottone "Copia valori"
  che pre-popola:
  - **Modalità AR**: joints (tender+swollen), VES, PCR, PGA, EGA dall'ultimo
    das28_esr/das28_crp/cdai/sdai della stessa data.
  - **Modalità SpA**: BASDAI q1-q6, ASDAS PGA, PCR, BASFI q1-q10 dall'ultimo
    basdai/asdas_crp/basfi della stessa data (merge intelligente delle voci
    condivise tra BASDAI e ASDAS come back pain/morningStiffness/peripheralPain).
  Logica: cerca l'ultimo assessment "pivot" (das28_esr per RA, basdai per SpA)
  per data, poi raccoglie tutti gli assessment della stessa data per ricostruire
  la visita composita completa. Toast di conferma al click. Messaggio UX chiaro:
  "Modifica solo i campi cambiati e salva".
- [x] **Iter diagnostico di Eosinofilia** nella sezione Miscellanea: nuovo
  algoritmo diagnostico completo strutturato in **9 step**:
  1. Conferma e stratificazione (lieve/moderata/severa/HES)
  2. Anamnesi mirata (farmaci DRESS, viaggi, atopia, sintomi sistemici)
  3. Esami di primo livello (emocromo con striscio, VES/PCR, IgE, B12, triptasi)
  4. Screening parassitario (Strongyloides CRUCIALE prima di GC)
  5. Screening autoimmune (ANCA/MPO/PR3 per EGPA)
  6. Imaging e accertamenti d'organo (HRCT, ecocardio per Löffler)
  7. Secondo livello ematologico (BOM, FIP1L1-PDGFRA, immunofenotipo L-HES)
  8. Diagnosi differenziale (reattive/autoimmuni/neoplastiche/linfoidi/HES-I)
  9. Red flags & management urgente (DRESS, Strongyloides, FIP1L1 → imatinib, EGPA)


- [x] **Form unificato Artrite Reumatoide** (`CompositeAssessmentDialog` mode="ra"):
  un solo dialog che compila contemporaneamente DAS28-VES + DAS28-PCR + CDAI + SDAI.
  Input condivisi: conta articolare 66/68 (con subset 28 estratto automaticamente),
  VES, PCR, PGA (0-10), EGA (0-10). Card "Risultati in tempo reale" con i 4
  punteggi calcolati live. Al salvataggio genera 4 assessment separati in parallelo
  (Promise.all). Accessibile dal dropdown "Nuova valutazione" → sezione "Form
  unificati" (amber) solo per pazienti con diagnosi AR.
- [x] **Form unificato Spondiloartrite** (`CompositeAssessmentDialog` mode="spa"):
  BASDAI + ASDAS-PCR + BASFI in un solo dialog. Voci VAS condivise (q1-q6
  BASDAI, riusate per backPain/peripheralPain/morningStiffness di ASDAS) + PGA
  specifico ASDAS + PCR + 10 domande BASFI. Al salvataggio genera 3 assessment.
  Accessibile per tutti i pazienti SpA/PsA.
- [x] **Domini di malattia PsA/SpA (GRAPPA)** — aggiunti due nuovi flag nel
  profilo SpA (`SpaProfileSection`):
  - `peripheral_involvement` (impegno articolare periferico)
  - `axial_involvement` (impegno assiale)
  I flag sono mostrati come card selettive con icone dedicate (Bone, MoveVertical)
  in una nuova sezione "Domini di malattia" sopra le manifestazioni extra-articolari.
- [x] **Logica suggerimenti intelligente**: se il paziente ha PsA con
  `axial_involvement=true`, il dropdown "Nuova valutazione" aggiunge automaticamente
  **ASDAS-CRP, BASDAI, BASFI** ai suggerimenti oltre a DAPSA/PASI/HAQ/DAS28/LEI
  (merge dinamico di `suggestForDiagnosis` con gli indici assiali). Il profilo
  `SpaProfileSection` ora notifica `onUpdated` al PatientDetail per aggiornare il
  flag senza reload della pagina.


- [x] **Linea del tempo terapie (Gantt)** sotto al grafico clinimetrie:
  visualizzazione orizzontale stile Gantt che mostra una riga per farmaco con
  nome esplicito (non più "categoria"). Le barre sono colorate per farmaco
  (palette stabile dal precedente `drugColorMap`), opache per terapie attive,
  semi-trasparenti per terapie sospese (con piccolo border destro grigio).
  Tooltip al hover con dettaglio: nome+dose, categoria, frequenza, range date,
  motivo di sospensione (incl. badge "automaticamente — nuovo biologico").
  Linea verticale tratteggiata "Oggi" e bordi sincronizzati con plot area.
- [x] **Conversione asse X grafico clinimetrie a time-scale**: il LineChart usa
  ora `scale="time"` con domain `[min, max]` calcolato dall'unione delle date
  delle valutazioni e delle terapie (esteso a "oggi" se ci sono terapie attive),
  così i punti del grafico sono posizionati proporzionalmente nel tempo e
  perfettamente allineati con le barre Gantt sottostanti. Stesso `width` di
  Y-axis (60px) su entrambi per allineamento orizzontale pixel-perfect.
- [x] **Regola anti-doppio biologico** (backend): nuova helper
  `_auto_discontinue_competing` invocata su POST e PUT di `/api/therapies`.
  Quando viene aggiunta o riattivata una terapia di categoria `bDMARD` o `tsDMARD`
  con `status=active`, qualsiasi altra terapia attiva di queste categorie per lo
  stesso paziente viene automaticamente sospesa (`status="discontinued"`,
  `end_date` impostato alla `start_date` del nuovo farmaco, flag
  `auto_discontinued=true`). Test verificato: Adalimumab attivo dal 2025-01-15 +
  POST Tocilizumab dal 2025-09-10 → Adalimumab passa a discontinued/end=2025-09-10/auto=true.
- [x] **Tooltip Gantt mostra causa di sospensione automatica** "Sospesa
  automaticamente (nuovo biologico)" quando flag `auto_discontinued`.


- [x] **Body chart entesiti per LEI** (`/app/frontend/src/components/EnthesisBodyChart.jsx`):
  SVG silhouette con 6 punti cliccabili posizionati anatomicamente (epicondilo
  laterale gomito sx/dx, condilo femorale mediale sx/dx, Achille calcagno sx/dx),
  etichette dei 3 gruppi di siti, indicatori "!" rossi sui siti attivati, legenda
  "Non doloroso/Doloroso", click toggla 0/1. Componente generico (accetta `positions`)
  pronto per estensione a MASES/SPARCC. Sostituisce le checkbox precedenti nel
  form LEI; mantiene anche la lista laterale sincronizzata.
- [x] **Criteri Fischer 2015 per IPAF** (Interstitial Pneumonia with Autoimmune
  Features, ATS/ERS Research Statement) — id `ipaf_2015_fischer`:
  - 3 requisiti obbligatori: IIP documentata (HRCT/biopsia), esclusione di
    eziologie alternative, NON soddisfa criteri di CTD definita
  - Dominio Clinico (7 elementi): mani da meccanico, ulcerazione polpastrello,
    artrite infiammatoria, teleangectasie palmari, Raynaud, edema digitale, Gottron
  - Dominio Sierologico (14 elementi): ANA ≥1:320, pattern nucleolare/centromerico,
    FR ≥2× ULN, anti-CCP, anti-dsDNA, Ro/SSA, La/SSB, RNP, Sm, Scl-70, anti-
    sintetasi (Jo-1/PL-7/PL-12/EJ/OJ/KS), PM-Scl, MDA5
  - Dominio Morfologico (14 elementi): pattern HRCT (NSIP/OP/NSIP-OP/LIP),
    pattern istologici, aggregati linfoidi, infiltrazione linfoplasmacellulare,
    multi-compartimentale (pleura/pericardio/vie aeree/vasculopatia)
  - Aggiunto "IPAF / ILD" a `CRITERIA_GROUPS`
- [x] **AI parse-visit estende LEI**: schema enum aggiornato con "lei", istruzione
  dedicata nel prompt. Test funzionale verificato: dato il testo "Achille destro
  e sinistro entrambi dolenti, epicondilo laterale destro dolente", l'AI restituisce
  correttamente score=3 con `inputs.sites: {achilles_l:true, achilles_r:true,
  lat_epicondyle_r:true, ...}`. PASI, terapie e diagnosi continuano a funzionare.


- [x] **Conta articolare 66/68 unificata** per tutti gli indici articolari
  (DAS28-ESR/CRP, CDAI, SDAI, DAPSA): l'homunculus mostra sempre tutte le 66/68
  articolazioni; per DAS28/CDAI/SDAI il sistema estrae automaticamente il subset
  di 28 articolazioni (spalle, gomiti, polsi, MCP, PIP, ginocchia) per il calcolo
  dello score, ma le altre articolazioni vengono comunque salvate. Nuovo helper
  `countTenderIn(joints, allowedKeys)` / `countSwollenIn` in `Homunculus.jsx`.
  Form mostra contemporaneamente TJC28/SJC28 (usati per il calcolo) e TJC totale/
  SJC totale (info aggiuntiva). Banner blu informativo nel form.
- [x] **LEI (Leeds Enthesitis Index)**: nuovo indice per entesiti in spondiloartrite
  e artrite psoriasica. 6 siti bilaterali (epicondilo laterale, condilo femorale
  mediale, inserzione tendine d'Achille), scoring binario 0/1, range totale 0-6.
  Interpretazione: 0 nessuna entesite, 1-2 lieve, 3-4 moderata, 5-6 severa.
  Aggiunto a `INDEX_LABELS`/`INDEX_DISEASES`, integrato nel form `AssessmentForm`,
  consigliato automaticamente per pazienti SpA/PsA via `diagnosisSuggestions.js`,
  esposto nel dropdown "Nuova valutazione" sotto sezione Spondiloartrite.


- [x] **Estensione collection generica `disease_profiles`** — ALLOWED_DISEASE_TYPES
  ora include: ra, spa, sle, aav, sjogren, myositis (ssc ha ancora il suo
  endpoint dedicato). Nessuna migrazione necessaria grazie allo schema flessibile.
- [x] **Profilo LES** (`SleProfileSection.jsx`): anticorpi (ANA + pattern/titolo,
  anti-dsDNA + titolo, Sm, Ro/SSA, La/SSB, RNP, aCL, anti-β2GPI, LAC), complemento
  (C3, C4), nefrite lupica con flag + classe ISN/RPS (I-VI + III+V, IV+V) +
  proteinuria 24h, altro.
- [x] **Profilo Vasculite ANCA** (`AavProfileSection.jsx`): pattern ANCA (cANCA/
  pANCA/atipico/negativo/non testato), specificità antigenica (PR3/MPO/entrambe),
  titolo, 10 organi coinvolti (Rene, Polmone, ORL, Cute, Neuro periferico, SNC,
  Occhio, GI, Cardiaco, MSK) con descrizione, base diagnostica multi-check (10
  opzioni: biopsie specifiche per organo, imaging TC/RMN/angio, clinica+ANCA,
  eosinofilia+asma EGPA), altro.
- [x] **Riepilogo vasculite in intestazione** (`AavSummaryHeader.jsx`): card
  condensata mostrata in cima alla scheda paziente vasculite che espone a colpo
  d'occhio: ANCA pattern + specificità antigenica (badge rosso), organi coinvolti
  (pill rossi), diagnosi basata su (pill grigi). Se profilo vuoto mostra messaggio
  ambra "compila profilo qui sotto". Data-testid `aav-header-summary/organs/basis/
  pattern/spec`.
- [x] **Profilo Sjögren** (`SjogrenProfileSection.jsx`): anticorpi (Ro/SSA +
  titolo, La/SSB + titolo, ANA, FR), test di Schirmer dx/sx (mm con flag ≤5
  patologico), flusso salivare non stimolato, biopsia ghiandole salivari minori
  con focus score (flag ≥1 patologico) + descrizione, altro.
- [x] **Profilo Miositi** (`MyositisProfileSection.jsx`): sottotipo (DM/CADM/PM/
  IBM/IMNM/ASyS/Overlap/JDM), CK max, aldolasi, ILD flag, 17 anticorpi miosite-
  specifici e associati raggruppati per categoria: MSA-ASyS (Jo1/PL-7/PL-12/EJ/
  OJ/KS), MSA-DM (Mi2/MDA5/TIF1γ/NXP2/SAE), MSA-IMNM (SRP/HMGCR), MAA-overlap
  (PM-Scl/Ku/U1-RNP/Ro52), altro.
- [x] **Modulo condiviso `/app/frontend/src/lib/diseaseDetection.js`**: funzioni
  `isRaDiagnosis/isSpaDiagnosis/isSleDiagnosis/isAavDiagnosis/isSjogrenDiagnosis/
  isMyositisDiagnosis` per evitare duplicazione nei componenti.
- [x] **Componente condiviso `TriState`** (`/app/frontend/src/components/ui/TriState.jsx`):
  selettore Positivo/Negativo/Non testato usato da tutti i profili con anticorpi.


- [x] **Puntini grafico per singolo farmaco** (non più per categoria):
  palette dedicata (`DRUG_PALETTE`, 18 colori), `buildDrugColorMap(chartData)`
  assegna un colore stabile a ogni farmaco in base all'ordine di comparsa.
  Legenda sotto il grafico ora elenca i nomi dei farmaci invece delle categorie
  (csDMARD/Biologico/ecc). Tooltip e puntini sotto asse X mostrano lo stesso
  colore per farmaco.
- [x] **Profilo clinico Artrite Reumatoide** (`RaProfileSection.jsx`):
  - Anticorpi: FR (Positivo/Negativo/Non testato + campo titolo se positivo),
    Anti-CCP/ACPA (stessa struttura)
  - Danno strutturale: forma Erosiva / Non erosiva (toggle mutualmente esclusivo)
  - ILD flag (checkbox con etichetta descrittiva "Pattern HRCT compatibile")
  - Campo testo "Altro" per note libere
  - Si mostra automaticamente per diagnosi contenenti "artrite reumatoide"
    / "rheumatoid" / "AR" isolato
- [x] **Profilo clinico Spondiloartrite** (`SpaProfileSection.jsx`):
  - 3 checkbox con card selettive: Psoriasi, Uveite, IBD (MICI) con etichette
    descrittive sottostanti
  - Campo testo "Altro" per note cliniche (entesite, dattilite, HLA-B27, ecc.)
  - Si mostra per diagnosi contenenti "spondilo", "anchilosante", "axspa",
    "artrite psoriasica", "psa", "as"
- [x] **Backend generico** `disease_profiles` collection con endpoint
  `/api/patients/{id}/disease-profile/{type}` (type = "ra" | "spa"), indice
  unique `(patient_id, disease_type)`. Estendibile facilmente per futuri
  profili (SLE, Vasculiti, Sjögren, ecc.) senza nuovi endpoint.
  Cascade delete aggiornato + incluso nell'export DB.


- [x] **Alert interazioni farmacologiche** (`/app/frontend/src/lib/drugInteractions.js`):
  database di 18 interazioni clinicamente rilevanti in reumatologia (MTX+TMP/SMX,
  MTX+FANS, MTX+PPI, MTX+Leflunomide, Colchicina+Macrolidi, Colchicina+Ciclosporina,
  Colchicina+Statine, Allopurinolo+Azatioprina/6-MP, Allopurinolo+Warfarin,
  JAKi+Vaccini vivi, JAKi+Anticoagulanti, HCQ+farmaci QT, Biologici+Vaccini vivi,
  Rituximab+Vaccini, GC+FANS, GC+Warfarin, Ciclofosfamide+Allopurinolo,
  Tacrolimus/Ciclosporina+CYP3A4, FANS+Anticoagulanti, MMF+Antiacidi, Leflunomide+Warfarin).
  Ogni interazione con livello di severità (Maggiore/Moderata/Minore), titolo e nota clinica.
- [x] **Banner alert in TherapySection**: card colorata (rosso=Maggiore, ambra=Moderata,
  blu=Minore) che compare automaticamente quando il paziente ha 2+ terapie attive
  che attivano una regola. Click sulla riga → espande la nota clinica. Conteggio
  per severità in badge circolari. Data-testid `interactions-alert` e
  `interaction-{id}` per test.
- [x] **Filtro clinimetrie per diagnosi**: il dropdown "Nuova valutazione" mostra
  SOLO gli indici rilevanti per la diagnosi del paziente (es. SpA → BASDAI/ASDAS/
  BASFI/BASMI/Schober; AR → DAS28/CDAI/SDAI/HAQ; SSc → mRSS/Capillaroscopia).
  Toggle "Mostra tutti gli indici (avanzato)" (data-testid `toggle-all-indices`)
  per casi fuori-quadro. Se la diagnosi non è mappata, mostra tutto.
- [x] **Tabella storico valutazioni ristrutturata**: colonne EULAR e TJC/SJC unite
  in un'unica colonna contestuale "Risposta / Dettagli" che mostra EULAR + joint
  counts SOLO per indici articolari (DAS28/CDAI/SDAI/DAPSA), altrimenti "—".
  Aggiunta nuova colonna "Terapia in corso" con pill colorate per categoria
  (csDMARD/bDMARD/tsDMARD/GC/FANS) che mostra i farmaci attivi alla data di ogni
  valutazione. Se nessuna terapia attiva a quella data, "Nessuna" in italico.
  Data-testid `therapies-cell-{id}` per test.

## Backlog aggiornato
### P1
- [ ] Refactor `AssessmentForm.jsx` (700 righe) in sotto-componenti per indice
  in `components/forms/` — era già in backlog
- [ ] Refactor `PatientDetail.jsx` (800 righe) in sotto-componenti (PatientHeader,
  AssessmentHistoryTable, TrendChart, SuggestionsCard)
- [ ] Espandere database interazioni farmacologiche con casi più rari
  (cotrimoxazolo+warfarin, biologici+TB, ecc.)
- [ ] Aggiungere drug interaction check anche all'atto dell'inserimento/modifica
  di una nuova terapia (alert in tempo reale nel dialog)


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
