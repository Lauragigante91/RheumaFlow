# RheumaFlow — README Tecnico

> Workspace clinico multi-tenant per reumatologi: gestione longitudinale dei pazienti, calcolo clinimetrico real-time, importazione strutturata da lettere di visita e referti PDF. Privacy by design.

Questo documento descrive **cosa fa ogni parte** del progetto. Il riferimento esteso, con esempi di endpoint e flussi, è in `README.md` (Developer Reference); questo file ne è la versione tecnica sintetica e allineata al codice reale.

---

## Indice

1. [Panoramica](#panoramica)
2. [Stack tecnologico](#stack-tecnologico)
3. [Avvio locale e variabili d'ambiente](#avvio-locale-e-variabili-dambiente)
4. [Struttura del repository](#struttura-del-repository)
5. [Backend (FastAPI)](#backend-fastapi)
6. [Frontend (React)](#frontend-react)
7. [Clinical Engine (lib/)](#clinical-engine-lib)
8. [Pipeline di importazione](#pipeline-di-importazione)
9. [PRO, Consulto, Export](#pro-consulto-export)
10. [Privacy by design](#privacy-by-design)
11. [Pattern architetturali chiave](#pattern-architetturali-chiave)
12. [Test e audit del parser](#test-e-audit-del-parser)
13. [Convenzioni di sviluppo](#convenzioni-di-sviluppo)
14. [User preferences](#user-preferences)

---

## Panoramica

RheumaFlow non è un semplice CRUD clinico. Contiene un **motore deterministico** ("Clinical Engine") che gira interamente nel browser ed estrae dati strutturati da testi di visita italiani senza dipendenze cloud, il calcolo di 15+ indici clinimetrici, e una pipeline di importazione da PDF/testo che riconcilia i dati estratti con lo storico del paziente.

**Principi fondamentali:**

- **Privacy by design**: il parsing avviene lato client e deterministico; l'anagrafica viene rimossa localmente prima di qualsiasi elaborazione e prima di qualunque chiamata AI opzionale.
- **Parsing deterministico come primario**: tutto ciò che è estraibile via regex/logica deterministica lo è. L'AI (Claude/Gemini) è solo un fallback opzionale, abilitabile per organizzazione.
- **Multi-tenancy**: ogni organizzazione (UO) è isolata tramite `organization_id`; nessun paziente è visibile da un'altra UO.
- **Architettura a episodi**: le terapie sono episodi con eventi embedded (non record piatti), il che consente la ricostruzione point-in-time dello stato terapeutico a qualsiasi data.

---

## Stack tecnologico

| Layer | Tecnologia | Note |
|-------|-----------|------|
| **Frontend** | React 19, Create React App + CRACO | Dev server porta **5000** |
| **Styling** | Tailwind CSS, shadcn/ui (Radix UI) | Componenti atomici in `components/ui/` |
| **Grafici** | Recharts | Andamenti longitudinali score/terapie |
| **Icone** | Lucide React | |
| **Routing** | React Router v7 | `App.js` |
| **HTTP** | Axios | Istanza unica + interceptor in `lib/api.js` |
| **Backend** | FastAPI (Python 3.11), Uvicorn ASGI | Porta **8000** |
| **Database** | MongoDB, driver Motor (async) | Dev: istanza locale; Prod: MongoDB Atlas (DB `rheumaflow`) |
| **Auth** | JWT in cookie `httpOnly` (access + refresh) | Password con bcrypt |
| **PDF parsing (client)** | pdf.js (`pdfjs-dist`) | Estrazione testo + de-identificazione nel browser |
| **PDF/OCR (server)** | PyMuPDF, pdfplumber, pytesseract | Parser referti lab lato server |
| **Export** | jsPDF (report clinici), openpyxl (XLSX coorte) | |
| **AI / LLM (opzionale)** | Claude (via LiteLLM/httpx), Gemini (fallback multimodale) | Attivo solo se l'org lo abilita e le chiavi sono presenti |

> **Nota AI**: non esiste un router `ai.py` dedicato. Il parsing AI è opzionale e gating-ato dietro la de-identificazione: il testo passa sempre prima da `deidentify.py` / `stripDemographics()`. Il percorso primario resta il parser deterministico locale.

---

## Avvio locale e variabili d'ambiente

```bash
bash start.sh          # Avvia FastAPI (8000) + React dev server (5000)
```

`start.sh` avvia il backend FastAPI e il dev server React. In sviluppo FastAPI fa da proxy/SPA fallback verso React; in produzione (`frontend/build/` presente) serve i file statici.

**Variabili backend (`backend/.env`):**

| Variabile | Obbligatoria | Descrizione |
|-----------|-------------|-------------|
| `MONGO_URL` | Sì (prod) | URI MongoDB (Atlas in produzione, locale in dev) |
| `JWT_SECRET` | Sì (prod) | Chiave di firma dei JWT |
| `PLATFORM_ACCESS_CODE` | Sì | Codice per creare una nuova organizzazione |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No | Credenziali admin di default seedate all'avvio |
| `DEFAULT_ORG_NAME` | No | Nome UO di default |
| `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` | No | Abilitano il parsing AI opzionale |
| `CORS_ORIGINS` | No | Origini CORS separate da virgola |

**Variabile frontend (`frontend/.env`):** `REACT_APP_BACKEND_URL` (vuota = stesso host in dev).

> All'avvio il backend seed-a l'organizzazione di default e l'utente admin (`ADMIN_PASSWORD` aggiorna solo l'hash di `admin@clinimetria.it`; le login personali sono hash bcrypt indipendenti).

---

## Struttura del repository

```
/
├── start.sh                       # Avvio backend + frontend
├── README.md                      # Developer Reference esteso
├── replit.md                      # Questo file (README Tecnico)
├── test_result.md                 # Log esiti test
│
├── backend/
│   ├── server.py                  # Entry point FastAPI: wiring router, CORS, startup (indici + seed), SPA fallback
│   ├── models.py                  # Modelli Pydantic v2 (~620 righe) — tutti con extra="ignore"
│   ├── helpers.py                 # verify_patient_in_org + ricostruzione point-in-time delle terapie
│   ├── deidentify.py              # Rimozione PII server-side prima dell'AI
│   ├── lab_parser.py              # Parser referti lab server-side (pdfplumber/PyMuPDF/OCR, ~50+ regole)
│   ├── auth_utils.py              # bcrypt, generazione/verifica JWT, get_current_user (cookie)
│   ├── database.py                # Connessione Motor/MongoDB, export `db`
│   ├── routers/                   # 10 domain router montati sotto /api
│   │   ├── auth.py                # register, login, logout, me, refresh, change-password, org settings/members, demo seed
│   │   ├── patients.py            # CRUD paziente, anonymize, recall, recenti
│   │   ├── clinical.py            # Assessments, Therapies (+ upsert/state), LabExams, InstrumentalExams, CriteriaEvaluations, SpecialistVisits
│   │   ├── clinical_events.py     # Timeline raccordo: list/create/batch/PATCH/confirm/soft-delete
│   │   ├── visits.py              # WorkupVisits + VisitTemplates (+ home_therapies_text auto)
│   │   ├── tokens.py              # PRO token + Consult token (con endpoint pubblici no-auth)
│   │   ├── profiles.py            # ScleroProfile, DiseaseProfile, Stats, parse-pdf-visit (zero-AI)
│   │   ├── conditions.py          # Comorbidità/condizioni con registry canonico
│   │   ├── reminders.py           # Promemoria/task clinici
│   │   └── export.py              # Export JSON, CSV-zip, XLSX coorte, aggregati diagnosi/farmaci
│   └── tests/
│
└── frontend/src/
    ├── App.js                     # Router principale (rotte pubbliche/protette)
    ├── contexts/
    │   └── AuthContext.jsx        # Stato auth globale, login/register/logout/refreshMe
    ├── hooks/
    │   ├── useArchiveValues.js
    │   ├── useEverPositiveAntibodies.js
    │   └── use-toast.js
    ├── pages/                     # 14 pagine (vedere §Frontend)
    ├── components/                # Componenti raggruppati per dominio (vedere §Frontend)
    └── lib/                       # Clinical Engine — 45 file JS puri, zero cloud (vedere §Clinical Engine)
```

---

## Backend (FastAPI)

### Multi-tenancy e autorizzazione
Ogni documento contiene `organization_id`. Ogni endpoint che tocca dati paziente passa da `verify_patient_in_org(patient_id, org_id)` (`helpers.py`): se il paziente non appartiene all'org → 403. Ogni richiesta (tranne le rotte pubbliche a token) è autenticata via `get_current_user`, che estrae `organization_id` dal JWT.

**Ruoli:**
- `admin` — primo utente che crea l'org con `PLATFORM_ACCESS_CODE`; gestisce impostazioni org (pseudonimizzazione, AI parsing, invite code).
- `member` — si unisce con l'invite code dell'org; accesso clinico completo.

### Autenticazione
JWT in cookie `httpOnly`: `access_token` (breve) + `refresh_token` (lungo). `POST /api/auth/refresh` rinnova l'access token; l'interceptor Axios emette `auth:unauthorized` su 401 e `AuthContext` gestisce il redirect. Seed admin idempotente a ogni avvio.

### Router e responsabilità

| Router | Responsabilità principale |
|--------|---------------------------|
| `auth.py` | Registrazione (crea org o unisce via invite), login/logout, `/auth/me`, refresh, cambio password, impostazioni e membri org, demo seed |
| `patients.py` | CRUD paziente, `PATCH` parziale (non-null=$set, null=$unset), `anonymize`, `recall`, liste recenti/recall |
| `clinical.py` | Assessments; **Therapies** con `POST /therapies/upsert` (continuità/dose-change/switch) e `GET .../therapies/state?date=` (ricostruzione point-in-time); auto-discontinuazione di bDMARD/tsDMARD concorrenti; LabExams (con upsert per data); InstrumentalExams; CriteriaEvaluations; SpecialistVisits |
| `clinical_events.py` | Timeline raccordo: list filtrabile, create singolo, **batch** (da import revisionato), PATCH (stampa `updated_by`/`updated_at`), confirm, soft-delete |
| `visits.py` | WorkupVisits (auto-genera `home_therapies_text` snapshot via helpers point-in-time) e VisitTemplates; lista membri org per condivisione task |
| `tokens.py` | **PRO**: genera token, endpoint pubblici per compilazione, conversione risposte in Assessment. **Consult**: link read-only a tempo per colleghi esterni |
| `profiles.py` | ScleroProfile, DiseaseProfile per-malattia, Stats org, `POST /parse-pdf-visit` (parser server zero-AI con PyMuPDF + analisi bounding-box che ignora le sidebar PII) |
| `conditions.py` | Comorbidità mappate a `CANONICAL_REGISTRY` per arricchirle con flag di rischio; upsert con dedup per `(patient_id, canonical_name, organization_id)` |
| `reminders.py` | Promemoria/task clinici (per paziente o standalone), in scadenza |
| `export.py` | `/export/json`, `/export/csv-zip`, `/export/cohort-xlsx` (XLSX multi-sheet per ricerca/audit), aggregati `/export/diagnoses` e `/export/drugs` |

### Modelli principali (`models.py`)
Tutti con `model_config = ConfigDict(extra="ignore")` (compatibilità forward).

| Modello | Note |
|---------|------|
| `Organization` | `invite_code`, `pseudonymized_mode` |
| `User` / `UserPublic` | `role`, `organization_id` |
| `Patient` | Anagrafica + profilo clinico esteso (pseudonimizzabile) |
| `Assessment` | Indice clinimetrico: `index_type`, `inputs`, `score`, `interpretation`, `visit_id`, `visit_category`, `source_filename` |
| `Therapy` / `TherapyEvent` | Episodio con `events[]` embedded; tipi evento: `started`, `dose_increased/decreased`, `discontinued`, `noted`, `historical_exposure`, `regimen_changed` |
| `LabExam` | `panel` (required) + `values` (dict param→valore), `source_filename` |
| `InstrumentalExam` | `exam_type`, `territory`, `result`, `origin` (visione/archive/nuova) |
| `ClinicalEvent` | Evento timeline: `event_type`, `titolo`, `categoria`, `date_value`, `date_precision`, `drug_canonical`, `confidence`, `inferred_by`, `source_origin` |
| `WorkupVisit` | Sezioni narrative + `referral_note`, `home_therapies_text`, `comorbidities_text` |
| `Condition` | `canonical_name`, `category`, `flags` |
| `DiseaseProfile` | `disease_type` + `data` (JSON per-malattia) |
| `PROToken` / `ConsultToken` | Link a token con scadenza |
| `Reminder` | Task/promemoria con `visibility` |

> **Convenzioni DB**: chiave applicativa `id` (UUID stringa), mai `_id` Mongo (escluso con `{"_id": 0}`). Tutti i `DELETE` sono soft (`deleted_at`); le liste filtrano `deleted_at: None`.

### Moduli condivisi
- `helpers.py` — `verify_patient_in_org`; `_episode_state_at` / `_therapy_state_at` ricostruiscono dose/freq/route attive a una data camminando sugli eventi embedded; usati anche per `home_therapies_text` ed export coorte.
- `deidentify.py` — rimuove CF, email, telefono, date di nascita, intestazioni ospedaliere, firme prima dell'invio all'LLM.
- `lab_parser.py` — pipeline server-side: pdfplumber → PyMuPDF → pytesseract OCR; 50+ regole reumatologiche con normalizzazione unità e plausibilità fisiologica.

---

## Frontend (React)

### Routing (`App.js`)

```
/login, /register           PublicOnly (redirige alla home se autenticati)
/pro/:token                 PublicPRO (pubblico, no auth)
/c/:token                   ConsultPage (pubblico, no auth)
/                           Dashboard
/pazienti                   Patients
/pazienti/:id               PatientDetail
/pazienti/:id/visita        PatientQuickVisit
/pazienti/:id/prima-visita  FirstVisitPage
/pazienti/:id/visita-workup WorkupVisitPage
/criteri                    Criteria
/linee-guida                Guidelines
/miscellanea                Miscellanea
/privacy                    Privacy
```

`AuthContext` gestisce lo stato auth; `ProtectedRoute` racchiude le rotte private dentro `Layout`.

### Pagine principali
- **Dashboard** — ponte di comando: KPI, to-do clinici (standalone o per paziente), widget pazienti recenti e recall.
- **PatientDetail** (~1700 righe) — hub e orchestratore di stato del paziente in follow-up: carica terapie/assessments/lab/profili e sincronizza i moduli (es. salvataggio score → auto-popolamento di `TodayVisitSection`).
- **WorkupVisitPage** — percorso diagnostico per nuovi invii, con import selettivo da prima visita/visite precedenti e generazione report PDF.
- **FirstVisitPage** — wizard di triage/anamnesi per il nuovo paziente.
- **PublicPRO** — pagina pubblica a token: questionari PRO con scoring client-side.
- **ConsultPage** — vista read-only pseudonimizzata condivisa con colleghi.
- Altre: **Patients**, **PatientQuickVisit**, **Criteria**, **Guidelines**, **Miscellanea**, **Privacy**, **Login**, **Register**.

### Componenti per dominio (`components/`)
- `ui/` — shadcn/ui (Button, Dialog, Card, Tabs…).
- `layout/` — `Layout`, `PatientHeader`, `StickyPatientHeader`, `PatientProfileStrip`, `RheumatologicStatusStrip`.
- `clinical/` — `AssessmentForm`, `CompositeAssessmentDialog`, `ClinicalTimelineManager`, `TrendChartCard`, `PlanSection`.
- `visits/` — `TodayVisitSection`, `VisitImportButton` (entry import), `ImportVisitFromTextModal`, `ImportVisitPdfModal`, `ImportMultiPdfModal`, `VisitReportDialog`, `ClinicalCockpit`, `VisitHistoryTable`.
- `therapy/` — `TherapySection`, `GestioneTerapiaModal`, `QuickTherapyModal`.
- `labs/` — `ExamsDialog`, `InstrumentalExamsSection`, `ChronologicalExamsTab`, `HistoryExportDialog`, `OcrScanButton`.
- `profiles/` — un componente per diagnosi (RA, SpA, SLE, SSc, AAV, IgAV, Behçet, CryoVas, UrticarialVas, PAN, CSVV, AOSD, APS, Gotta, MCTD, IgG4-RD, RPC, Sjögren, Miositi, PMR/LVV…); la selezione è guidata da `lib/diseaseDetection.js`.
- `imaging/` — `Homunculus`, `MRSSHomunculus`, `VascularHomunculusDialog`, `SpaJointsPanel`, `EnthesisBodyChart`, dialog imaging specialistici.
- `patient/` — `ClinicalAlerts`, `ClassificationBadges`, `ActiveProblemsCard`, `RecallFlagControl`.
- `reminders/`, `conditions/`, `shared/`, `specialist/`.

### Contexts e hooks
- `contexts/AuthContext.jsx` — stato auth globale (`login`, `register`, `logout`, `refreshMe`).
- `hooks/` — `useArchiveValues`, `useEverPositiveAntibodies`, `use-toast`.

---

## Clinical Engine (lib/)

Cuore deterministico del sistema: **45 file JS puri** eseguiti interamente nel browser. La sorgente unica di verità per i farmaci è `drugs.js` (`DRUG_ALIAS_MAP`); tutti i parser ne derivano.

### Parsing testi di visita
- `visitTextParser.js` (`parseVisitText`) — parser principale a due passi (normalizzazione + estrazione). Estrae diagnosi, terapie, assessments, lab, sezioni narrative, profilo generale, referti strumentali ed eventi raccordo. Restituisce `{ extracted, parse_review }`; `parse_review` segnala item `unresolved`/`low_confidence` per la review manuale. Gestisce dosi totali, frequenze, PRN/al-bisogno (con sentence-scoping anti-contaminazione) e sospensioni narrative.
- `raccordoParser.js` (`parseRaccordoTimeline`) — estrae eventi longitudinali dal "raccordo anamnestico": `therapy_start/stop/switch`, `dose_spacing`, `disease_onset`, `manifestation_onset`, `remission`, `flare`. Gestisce date precise (anno/mese-anno/data) e approssimate ("metà/inizio/fine YYYY", range `(YYYY-YYYY)`), con guard di negazione e loop multi-stop.
- `clinimetryTextParser.js` (`parseClinimetryFromText`) — riconosce score già scritti nel testo (collasso trend, stripping comparativi "era/precedente").
- `therapyTextParser.js`, `historicalTherapyParser.js`, `therapyEventParser.js`, `concomitantDrugParser.js`, `jointExamParser.js`, `letterSectionParser.js`, `instrumentalParser.js`, `sscAntibodyParser.js` — parser specializzati (terapie quick, esposizioni storiche, eventi, farmaci concomitanti, esame articolare, segmentazione lettera, referti strumentali, anticorpi SSc).

### Estrazione lab e PDF
- `labValueExtractor.js` (`extractLabValuesByDate`, `LAB_CATALOG`, `toCanonicalLabKey`) — estrae valori lab con data, alias→chiave canonica, regole unità (PCR default mg/dL, nessuna conversione implicita), pattern qualitativi; chiavi ad alto rischio con unità inferita → review.
- `labPanels.js` — definizione pannelli lab.
- `pdfLabExtractor.js` (`extractTextFromPdf`) — estrazione testo via pdf.js con interval-merging per testo a colonne/sidebar.
- `pdfDeidentifier.js` (`stripDemographics`) — de-identificazione client-side del testo PDF.

### Riconciliazione e import
- `visitReconciler.js` (`reconcileDrafts`, `ITEM_STATUS`) — confronta i draft con lo storico DB e annota `_status` (new/duplicate/continued/conflict/update). Usa sempre `.listByPatient()` (mai `.list()`).
- `importPayloadBuilders.js` — trasforma l'output del parser in payload pronti per le API.

### Clinimetria e conoscenza clinica
- `clinimetrics.js` — 15+ indici (DAS28-ESR/CRP, CDAI, SDAI, BASDAI, ASDAS, DAPSA, SLEDAI-2K, HAQ/mHAQ, ESSDAI/ESSPRI, BVAS, MMT-8, FIQR, mRSS, PASI, LEI, BASFI/BASMI, capillaroscopia, Schober…) con interpretazioni e risposte EULAR/ACR.
- `assessmentScoring.js`, `compositeReusePrev.js` — scoring e riuso valori precedenti negli assessment compositi.
- `criteria.js` (`CRITERIA`), `guidelines.js` (`GUIDELINES`), `miscellanea.js` — basi di conoscenza per criteri di classificazione, linee guida EULAR/ACR e calcolatori accessori.
- `diseaseDetection.js` — cascade `isRaDiagnosis()`, `isSpaDiagnosis()`, ecc. (diagnosi rare testate prima di `isAavDiagnosis`).
- `diseaseWidgets.js`, `diagnosisSuggestions.js` — workflow per malattia e suggerimenti indici/criteri per diagnosi.
- `conditions.js` — registry canonico comorbidità + sinonimi.
- `everPositiveAntibodies.js` — mappa "mai positivo" per anticorpi malattia-specifici.

### Farmaci, terapie, sicurezza
- `drugs.js` — `DRUG_ALIAS_MAP` (~160 farmaci + alias IT, abbreviazioni biologiche case-sensitive con `\b`), `DRUGS`, `INDICATIONS`, regimi.
- `drugInteractions.js` — interazioni reumatologiche (`detectInteractions`).
- `safetyReminders.js` — checklist di sicurezza per farmaco (`detectSafetyReminders`).
- `therapyPresets.js`, `therapySuggestions.js`, `prescriptionExpansion.js`, `steroidTapering.js`, `biologicCalendar.js`, `scheduleTimeline.js` — preset/suggerimenti T2T, espansione prescrizioni, piani di tapering steroideo, calendario biologici, timeline schedule.

### PRO, prima visita, export, utilità
- `proInstruments.js` — definizioni strumenti PRO (HAQ, BASDAI, RAPID3…) con scoring.
- `firstVisitData.js`, `firstVisitReport.js` — struttura dati e report della prima visita.
- `instrumentalFormatters.js` — formattatori narrativi per imaging (PET/TC, ecc.).
- `export.js` — report PDF clinici via jsPDF (`fmtComorbForReport` merge allergie+comorbidità con dedup).
- `privacyTemplates.js` — generazione PDF informativa/registro trattamenti.
- `api.js` — istanza Axios + 22 oggetti `*Api`; interceptor che appiattisce gli errori Pydantic in messaggi leggibili.
- `utils.js` — helper (`cn`).

---

## Pipeline di importazione

Tre modalità, sempre con **un documento per PDF/lettera** (mai concatenati):

1. **Singolo testo** — `VisitImportButton` (mode `single`) → `parseVisitText()` → `SectionReviewPanel` (se `unresolved`/`low_confidence` > 0) → `buildEditableDraft()` (stampa `_id` e `_skip:false`) → review utente → `_applyOneDraft()` (filtra `!_skip`, chiama le API).
2. **Singolo PDF** — `ImportVisitPdfModal` → `extractTextFromPdf()` → `stripDemographics()` → rilevamento data → prosegue come singolo testo.
3. **Multi-PDF** — `ImportMultiPdfModal` → per ogni file estrazione+de-id+data → `VisitImportButton` (mode `multi`) → `parseMulti()` (fetch storico via `allSettled` + `reconcileDrafts()`) → wizard di review con badge `_status` → `applyMulti()`.

**Traceability**: ogni entità importata da PDF porta `source_filename` (e `clinical_events` anche `source_origin`/`source_section`).

---

## PRO, Consulto, Export

- **PRO**: il medico genera un token (`POST /api/pro-tokens`) con strumenti e scadenza → il paziente compila a `/pro/:token` (scoring client-side) → invio pubblico → il medico converte le risposte in `Assessment`.
- **Consulto**: link read-only pseudonimizzato a tempo (`/c/:token`), con campi inclusi scelti dal mittente; nessun login per il destinatario.
- **Export**: dump JSON, CSV-zip, XLSX coorte multi-sheet, aggregati diagnosi/farmaci; report clinici PDF (`VisitReportDialog`, `HistoryExportDialog`).

---

## Privacy by design

1. **Client** (sempre attivo): `stripDemographics()` rimuove anagrafica dal testo PDF prima di qualsiasi elaborazione; il parsing è interamente locale.
2. **Pre-LLM** (solo se l'org abilita l'AI): `deidentify.py` applica ulteriori rimozioni PII prima dell'invio a Claude/Gemini.
3. **Pseudonimizzazione paziente**: `POST /api/patients/:id/anonymize` e modalità org-wide `pseudonymized_mode`.

---

## Pattern architetturali chiave

- **Episode model (terapie)**: un documento `db.therapies` = un episodio; la sospensione chiude sempre l'episodio, un riavvio crea un nuovo documento; eventi in `events[]`; `POST /therapies/upsert` gestisce continuità/dose-change/switch.
- **Therapy state point-in-time**: `GET .../therapies/state?date=` ricostruisce i farmaci attivi a una data; alimenta `home_therapies_text` (snapshot immutabile alla creazione della visita) ed export coorte.
- **Import draft pattern**: `buildEditableDraft()` → `_skip`/`_id` su ogni item; `_applyOneDraft()` filtra `!_skip`. Contratto stabile tra parser e UI di review.
- **DRUG_ALIAS_MAP single source of truth**: aggiungere farmaci solo in `drugs.js`.
- **ClinicalTimelineManager autonomo**: fetcha i propri dati da `patientId`, non contamina lo stato del parent.
- **Unità lab**: PCR default mg/dL, nessuna conversione implicita; unità inferite su chiavi ad alto rischio → review manuale.
- **Soft delete + UUID**: `deleted_at` logico; `id` UUID come chiave applicativa.

---

## Test e audit del parser

- **Regression test frontend** (`frontend/src/lib/__tests__/parser_regression.js`): suite end-to-end su casi clinici reali. Esecuzione:
  ```bash
  cd frontend && npx esbuild src/lib/__tests__/parser_regression.js \
    --bundle --platform=node --outfile=/tmp/parser_reg.cjs --format=cjs \
    && node /tmp/parser_reg.cjs
  ```
- **Test unitari** (`frontend/src/__tests__/`): `visitTextParser.test.js`, `labValueExtractor.test.js`, `clinimetryTextParser.test.js`.
- **Audit raccordoParser** (`poc/`):
  ```bash
  bash poc/build.sh && node poc/audit_parser_live.js   # metriche TP/FP/FN/F1 per test case
  ```
  Output in `poc/results/<timestamp>/` (JSON, CSV, report md). Eseguire l'audit per le metriche correnti aggiornate.

---

## Convenzioni di sviluppo

- Lingua di UI, chat e commenti: italiano. Nessun commento nel codice salvo richiesta esplicita. Nessuna emoji.
- Mantenere la struttura a file esistente; non creare file extra non necessari.
- Parsing deterministico locale prima dell'AI (sempre).
- Tutti i modelli Pydantic con `extra="ignore"`. Tutte le chiamate HTTP via `lib/api.js`.
- Chiave canonica lab sempre `param_key` (fallback `toCanonicalLabKey()`).
- `verify_patient_in_org` su ogni endpoint paziente. Soft delete e UUID come ID applicativo ovunque.

---

## User preferences

- Lingua delle UI e dei commenti nel codice: **italiano**
- Nessun commento nei file a meno che non sia esplicitamente richiesto
- Nessuna emoji nei file
- Mantenere la struttura a file esistente (non creare file extra non necessari)
- Il parsing deterministico locale ha sempre la precedenza sul parsing AI
