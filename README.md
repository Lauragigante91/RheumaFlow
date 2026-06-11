# RheumaFlow — Developer Reference

> Workspace clinico specializzato per reumatologi. Gestione longitudinale dei pazienti, calcolo clinimetrico real-time, importazione strutturata da testi e PDF, privacy by design.

---

## Indice

1. [Panoramica del progetto](#1-panoramica-del-progetto)
2. [Stack tecnologico](#2-stack-tecnologico)
3. [Avvio locale](#3-avvio-locale)
4. [Variabili d'ambiente](#4-variabili-dambiente)
5. [Struttura del repository](#5-struttura-del-repository)
6. [Backend — FastAPI](#6-backend--fastapi)
   - [Architettura multi-tenant](#architettura-multi-tenant)
   - [Autenticazione e autorizzazione](#autenticazione-e-autorizzazione)
   - [Routers e API endpoints](#routers-e-api-endpoints)
   - [Modelli Pydantic](#modelli-pydantic)
   - [Database MongoDB](#database-mongodb)
   - [Moduli condivisi](#moduli-condivisi)
7. [Frontend — React](#7-frontend--react)
   - [Routing applicativo](#routing-applicativo)
   - [Pagine principali](#pagine-principali)
   - [Componenti per dominio](#componenti-per-dominio)
8. [Clinical Engine (lib/)](#8-clinical-engine-lib)
   - [visitTextParser.js](#visittextparserjs)
   - [raccordoParser.js](#raccordoparserjs)
   - [visitReconciler.js](#visitreconcilerjs)
   - [clinimetrics.js](#clinimetricsjs)
   - [labValueExtractor.js](#labvalueextractorjs)
   - [Altri moduli lib/](#altri-moduli-lib)
9. [Pipeline di importazione](#9-pipeline-di-importazione)
10. [Sistema PRO (Patient-Reported Outcomes)](#10-sistema-pro-patient-reported-outcomes)
11. [Consulto e link condivisione](#11-consulto-e-link-condivisione)
12. [Export e reportistica](#12-export-e-reportistica)
13. [Privacy by Design](#13-privacy-by-design)
14. [Pattern architetturali chiave](#14-pattern-architetturali-chiave)
15. [Test e POC](#15-test-e-poc)
16. [Convenzioni di sviluppo](#16-convenzioni-di-sviluppo)

---

## 1. Panoramica del progetto

RheumaFlow è un **workspace clinico multi-tenant** per reumatologi. Non è un semplice CRUD: contiene un motore clinico deterministico che gira interamente nel browser (zero cloud per il parsing), il calcolo di oltre 15 indici clinimetrici, e un sistema di importazione strutturata da lettere di visita e referti PDF.

**Principi fondamentali:**

- **Privacy by design**: il parsing del testo avviene lato client (deterministico, nessun dato inviato al cloud). La de-identificazione avviene localmente prima di qualsiasi chiamata AI opzionale.
- **Parsing deterministico locale come primario**: tutto ciò che può essere estratto con regex/logica deterministica lo è. L'AI (Claude/Gemini) è un fallback opzionale.
- **Multi-tenancy**: ogni organizzazione (UO) è isolata. Nessun paziente è visibile da un'altra UO.
- **Architettura a episodi**: le terapie sono gestite come episodi con eventi embedded (non record piatti), permettendo la ricostruzione point-in-time dello stato terapeutico.

---

## 2. Stack tecnologico

| Layer | Tecnologia | Note |
|-------|-----------|------|
| **Frontend** | React 19, Create React App + CRACO | Porta dev: 5000 |
| **Styling** | Tailwind CSS, shadcn/ui (Radix UI) | Componenti in `components/ui/` |
| **Grafici** | Recharts | TrendChartCard, PmrLvvTimeline |
| **Icone** | Lucide React, Phosphor Icons | |
| **Forms** | React Hook Form + Zod | |
| **Backend** | FastAPI (Python 3.11), Uvicorn ASGI | Porta: 8000 |
| **Database** | MongoDB locale (`data/mongodb/`) | Driver: Motor (async) |
| **AI / LLM** | Claude 3 Haiku via LiteLLM (opzionale) | Solo se `ANTHROPIC_API_KEY` presente |
| **Auth** | JWT in cookie `httpOnly` (access + refresh) | bcrypt per password |
| **PDF parsing** | pdf.js lato client (browser) | PyMuPDF + pdfplumber + tesseract lato server per lab |
| **OCR** | Tesseract.js (browser) + pytesseract (server) | |
| **Export** | jsPDF + jsPDF-autotable | Report clinici in PDF |
| **QR code** | qrcode (npm) | Per link PRO |

**Dipendenze Python chiave:** `fastapi`, `motor`, `pymongo`, `pydantic` v2, `python-jose`, `passlib`, `bcrypt`, `httpx`, `pdfplumber`, `pymupdf`, `pytesseract`, `openpyxl`.

---

## 3. Avvio locale

```bash
bash start.sh
```

`start.sh` fa tre cose in sequenza:
1. Avvia MongoDB locale (`data/mongodb/`) sulla porta 27017
2. Installa le dipendenze Python (idempotente) e avvia FastAPI su porta 8000
3. Avvia il dev server React su porta 5000

**In sviluppo**, FastAPI fa da proxy verso React (SPA fallback). In produzione (`frontend/build/` presente) serve i file statici direttamente.

> Credenziali admin di default: `admin@clinimetria.it` / `admin123`
> Vengono create automaticamente al primo avvio se non esistono.

---

## 4. Variabili d'ambiente

File: `backend/.env`

| Variabile | Obbligatoria | Descrizione |
|-----------|-------------|-------------|
| `MONGO_URL` | No (default: localhost:27017) | URI MongoDB |
| `JWT_SECRET` | Sì (prod) | Chiave per firmare i JWT |
| `PLATFORM_ACCESS_CODE` | Sì | Codice per creare una nuova organizzazione |
| `ADMIN_EMAIL` | No | Email admin di default (`admin@clinimetria.it`) |
| `ADMIN_PASSWORD` | No | Password admin di default (`admin123`) |
| `DEFAULT_ORG_NAME` | No | Nome UO di default (`UO Reumatologia`) |
| `ANTHROPIC_API_KEY` | No | Abilita parsing AI con Claude 3 Haiku |
| `GOOGLE_API_KEY` | No | Abilita Gemini 2.0 Flash come fallback multimodale |
| `CORS_ORIGINS` | No | Origini CORS separate da virgola |

File: `frontend/.env` (o `frontend/.env.local`)

| Variabile | Descrizione |
|-----------|-------------|
| `REACT_APP_BACKEND_URL` | URL del backend (vuoto = stesso host in dev) |

---

## 5. Struttura del repository

```
/
├── start.sh                    # Entry point unico per avviare tutto
├── data/mongodb/               # Dati MongoDB persistenti (gitignored)
│
├── backend/
│   ├── server.py               # Entry point FastAPI: routing, CORS, startup, SPA fallback (~211 righe)
│   ├── models.py               # Tutti i modelli Pydantic v2 (~620 righe)
│   ├── helpers.py              # verify_patient_in_org, logica terapie point-in-time, formatting
│   ├── deidentify.py           # De-identificazione testo pre-AI
│   ├── lab_parser.py           # Parser server-side per referti lab (PDF/OCR)
│   ├── auth_utils.py           # hash_password, verify_password, get_current_user
│   ├── database.py             # Connessione Motor/MongoDB, export `db`
│   └── routers/
│       ├── auth.py             # Login, register, JWT refresh, org settings, demo seed
│       ├── patients.py         # CRUD paziente + anonimizzazione + recall
│       ├── clinical.py         # Assessments, InstrumentalExams, Therapies, LabExams, SpecialistVisits
│       ├── clinical_events.py  # Timeline raccordo CRUD (+ batch + confirm)
│       ├── visits.py           # WorkupVisits, VisitTemplates
│       ├── tokens.py           # PRO tokens + Consult tokens (endpoint pubblici, no auth)
│       ├── profiles.py         # ScleroProfile, DiseaseProfile, Stats, ParsePdfVisit
│       ├── conditions.py       # Condizioni/comorbidità (registry + upsert)
│       ├── reminders.py        # Promemoria/task clinici
│       └── export.py           # Export JSON, CSV, XLSX coorte, diagnosi, farmaci
│
├── frontend/
│   └── src/
│       ├── App.js              # Router principale (React Router v7)
│       ├── contexts/
│       │   └── AuthContext.jsx # Auth state globale (JWT + /auth/me polling)
│       ├── pages/
│       │   ├── Dashboard.jsx         # Ponte di comando: KPI, to-do, recent, recall
│       │   ├── Patients.jsx          # Lista pazienti con ricerca
│       │   ├── PatientDetail.jsx     # Hub paziente (~1700 righe) — follow-up
│       │   ├── PatientQuickVisit.jsx # Visita rapida
│       │   ├── FirstVisitPage.jsx    # Wizard 6-step prima visita
│       │   ├── WorkupVisitPage.jsx   # Visita di approfondimento diagnostico
│       │   ├── Criteria.jsx          # Criteri di classificazione standalone
│       │   ├── Guidelines.jsx        # Linee guida EULAR/ACR integrate
│       │   ├── Miscellanea.jsx       # Calcolatori accessori
│       │   ├── Privacy.jsx           # Informativa privacy
│       │   ├── PublicPRO.jsx         # Pagina pubblica PRO (no auth, token-based)
│       │   ├── ConsultPage.jsx       # Pagina consulto read-only (no auth, token-based)
│       │   ├── Login.jsx
│       │   └── Register.jsx
│       ├── components/
│       │   ├── ui/                   # shadcn/ui: Button, Card, Dialog, Input, Select, Tabs…
│       │   ├── layout/               # Layout, PatientHeader, PatientProfileStrip,
│       │   │                         #   RheumatologicStatusStrip, StickyPatientHeader, BrandMark
│       │   ├── clinical/             # AssessmentForm, ClinicalTimelineManager,
│       │   │                         #   CompositeAssessmentDialog, TrendChartCard, PlanSection…
│       │   ├── visits/               # TodayVisitSection, VisitImportButton,
│       │   │                         #   ImportVisitPdfModal, ImportMultiPdfModal,
│       │   │                         #   VisitReportDialog, ClinicalCockpit…
│       │   ├── therapy/              # TherapySection, GestioneTerapiaModal, QuickTherapyModal
│       │   ├── labs/                 # ExamsDialog, InstrumentalExamsSection,
│       │   │                         #   ChronologicalExamsTab, HistoryExportDialog, OcrScanButton…
│       │   ├── profiles/             # Un componente per ogni diagnosi supportata (vedere §7)
│       │   ├── imaging/              # Homunculus, MRSSHomunculus, VascularHomunculus,
│       │   │                         #   SpaJointsPanel, EnthesisBodyChart…
│       │   ├── patient/              # ClinicalAlerts, ClassificationBadges,
│       │   │                         #   ActiveProblemsCard, RecallFlagControl…
│       │   ├── reminders/            # RemindersSection, QuickTaskDialog
│       │   ├── conditions/           # ConditionsPanel
│       │   └── shared/               # ItalianDatePicker, SelectableTextArea,
│       │                             #   QuickClinimetryImportModal
│       ├── lib/                      # Clinical Engine — deterministico, zero cloud (vedere §8)
│       └── hooks/
│           ├── useArchiveValues.js
│           └── useEverPositiveAntibodies.js
│
└── poc/                         # Strumenti di sviluppo per raccordoParser
    ├── build.sh                 # Bundle raccordoParser per test Node.js
    ├── audit_parser_live.js     # Audit TC1-TC15 con metriche TP/FP/FN
    ├── test_texts.json          # 15 test case annotati con ground truth
    └── results/                 # Output audit per sprint
```

---

## 6. Backend — FastAPI

### Architettura multi-tenant

Ogni documento nel database contiene `organization_id`. La dependency `verify_patient_in_org(patient_id, org_id)` in `helpers.py` è chiamata da ogni endpoint che accede a dati paziente:

```python
await verify_patient_in_org(patient_id, user["organization_id"])
# Se il paziente non appartiene all'org → 403 Forbidden
```

**Livelli di accesso:**

| Ruolo | Come si ottiene | Permessi |
|-------|----------------|----------|
| `admin` | Primo utente che crea una nuova org con `PLATFORM_ACCESS_CODE` | CRUD completo + impostazioni org |
| `member` | Registrazione con invite code dell'org | CRUD clinico completo |

**Invite code:** ogni org ha un codice a 8 caratteri generato automaticamente. Un admin lo trova nelle impostazioni e lo condivide ai colleghi per l'accesso.

### Autenticazione e autorizzazione

- **JWT in cookie `httpOnly`**: `access_token` (breve durata) + `refresh_token` (lunga durata)
- **Endpoint refresh**: `POST /api/auth/refresh` — rinnova l'access token automaticamente
- **Interceptor Axios** (`api.js`): su 401 emette `auth:unauthorized` su `window`; `AuthContext` gestisce il redirect al login
- **Seed admin**: a ogni avvio, se l'utente admin non esiste viene creato con credenziali da env. Se la password in env è cambiata, l'hash viene aggiornato.
- **Demo seed**: `POST /api/auth/demo` popola una nuova org con 3 pazienti dimostrativi (AR, SpA, LES) con storia clinica realistica

### Routers e API endpoints

#### `/api/auth` — Autenticazione e Organizzazioni

```
GET  /                          Health check
POST /auth/register             Registrazione (crea org o si unisce via invite code)
POST /auth/demo                 Login demo con seed automatico
POST /auth/login                Login con email/password
POST /auth/logout               Revoca cookie
GET  /auth/me                   Profilo utente corrente
POST /auth/change-password      Cambio password
PUT  /organization/settings     Impostazioni org (solo admin): pseudonymized_mode, invite_code
POST /auth/refresh              Refresh JWT
GET  /organization/members      Lista membri dell'organizzazione
```

#### `/api/patients` — Pazienti

```
POST   /patients                Crea paziente
GET    /patients                Lista pazienti dell'org
GET    /patients/{id}           Dettaglio paziente
PUT    /patients/{id}           Update completo
PATCH  /patients/{id}           Update parziale (non-null = $set, null = $unset)
DELETE /patients/{id}           Eliminazione logica
POST   /patients/{id}/anonymize Pseudonimizzazione (rimuove anagrafica)
PUT    /patients/{id}/recall    Imposta/rimuovi flag di recall con data
GET    /patients-recall         Lista pazienti in recall
GET    /patients-recent-mine    Pazienti visti di recente dall'utente corrente
```

#### `/api/` — Clinical (Assessments, Terapie, Lab, Strumentali)

```
POST   /assessments                          Crea score clinimetrico
PUT    /assessments/{id}                     Aggiorna score
GET    /patients/{id}/assessments            Lista score paziente
GET    /assessments/{id}                     Singolo score
DELETE /assessments/{id}                     Elimina score

POST   /therapies                            Crea episodio terapeutico
POST   /therapies/upsert                     Upsert intelligente (continuità/switch/dose change)
POST   /therapies/{id}/events                Aggiungi evento a episodio
GET    /patients/{id}/therapies              Lista episodi terapeutici
GET    /patients/{id}/therapies/state        Ricostruzione point-in-time (?date=YYYY-MM-DD)
PUT    /therapies/{id}                       Update episodio
DELETE /therapies/{id}                       Elimina episodio

POST   /lab-exams                            Crea referto laboratorio
POST   /lab-exams/upsert                     Upsert per data (aggiorna se stessa data esiste)
GET    /patients/{id}/lab-exams              Lista referti lab
PUT    /lab-exams/{id}                       Update referto
DELETE /lab-exams/{id}                       Elimina referto

POST   /instrumental-exams                   Crea esame strumentale
GET    /patients/{id}/instrumental-exams     Lista esami strumentali
GET    /instrumental-exams/{id}              Singolo esame
PUT    /instrumental-exams/{id}              Update esame
DELETE /instrumental-exams/{id}              Elimina esame

POST   /criteria-evaluations                 Crea valutazione criteri classificazione
GET    /patients/{id}/criteria-evaluations   Lista valutazioni
DELETE /criteria-evaluations/{id}            Elimina valutazione

POST   /specialist-visits                    Crea visita specialistica esterna
GET    /patients/{id}/specialist-visits      Lista visite specialistiche
PUT    /specialist-visits/{id}               Update
DELETE /specialist-visits/{id}               Elimina
```

#### `/api/` — Clinical Events (Timeline Raccordo)

```
GET    /patients/{id}/clinical-events              Lista eventi (filtrabili per event_type, confirmed)
POST   /patients/{id}/clinical-events              Crea evento singolo
POST   /patients/{id}/clinical-events/batch        Batch create (da import raccordo revisionato)
PATCH  /patients/{id}/clinical-events/{eid}        Update (stampa updated_by/updated_at)
PATCH  /patients/{id}/clinical-events/{eid}/confirm  Conferma evento (confirmed_by_user=true)
DELETE /patients/{id}/clinical-events/{eid}        Soft delete (deleted_at)
```

#### `/api/` — Visits

```
GET    /visit-templates             Lista template visita
POST   /visit-templates             Crea template
PUT    /visit-templates/{id}        Update template
DELETE /visit-templates/{id}        Elimina template

POST   /patients/{id}/workup-visits Crea visita workup
GET    /patients/{id}/workup-visits Lista visite workup
PUT    /workup-visits/{id}          Update completo visita
PATCH  /workup-visits/{id}          Update parziale
PATCH  /workup-visits/{id}/complete Marca visita come completata
DELETE /workup-visits/{id}          Elimina visita
```

#### `/api/` — Tokens (PRO + Consult)

```
POST   /pro-tokens                    Genera token PRO per paziente
GET    /patients/{id}/pro-tokens      Lista token PRO
DELETE /pro-tokens/{tid}              Revoca token
POST   /pro-tokens/{tid}/convert      Converte risposte PRO in Assessment

GET    /public/pro/{token}            [NO AUTH] Dati per compilazione PRO
POST   /public/pro/{token}/submit     [NO AUTH] Sottomissione risposte PRO

POST   /patients/{id}/consult-token   Genera link consulto
GET    /patients/{id}/consult-tokens  Lista link consulto
DELETE /consult-tokens/{tid}          Revoca link
GET    /public/consult/{token}        [NO AUTH] Vista read-only paziente pseudonimizzato
```

#### `/api/` — Profiles

```
GET    /stats                                    Statistiche org aggregate
GET    /patients/{id}/sclero-profile             Profilo SSc
PUT    /patients/{id}/sclero-profile             Upsert profilo SSc
GET    /patients/{id}/disease-profile/{type}     Profilo malattia-specifico
PUT    /patients/{id}/disease-profile/{type}     Upsert profilo malattia
DELETE /patients/{id}/disease-profile/{type}     Elimina profilo malattia
POST   /parse-pdf-visit                          Parsing server-side PDF visita (AI opzionale)
```

#### `/api/` — Conditions

```
POST   /conditions             Crea condizione/comorbidità
POST   /conditions/upsert      Upsert smart (dedup per canonical_name + org)
GET    /patients/{id}/conditions  Lista condizioni paziente
PUT    /conditions/{id}        Update condizione
DELETE /conditions/{id}        Elimina condizione
GET    /conditions/registry    Registry canonico (~60 condizioni V1 + metadata)
GET    /conditions/label-map   Mappa label → canonical_name (per parser)
```

#### `/api/` — Reminders

```
POST   /reminders                  Crea promemoria
GET    /patients/{id}/reminders    Lista promemoria paziente
GET    /reminders/upcoming         Promemoria in scadenza (tutti i pazienti dell'org)
PUT    /reminders/{id}             Update promemoria
DELETE /reminders/{id}             Elimina promemoria
```

#### `/api/export`

```
GET /export/json          Dump JSON completo org (tutti i pazienti)
GET /export/csv-zip       ZIP con CSV per ogni collection
GET /export/cohort-xlsx   XLSX multi-sheet: anagrafica, diagnosi, terapie, lab
GET /export/diagnoses     Aggregati diagnosi per analytics
GET /export/drugs         Aggregati farmaci per analytics
```

### Modelli Pydantic

Tutti in `backend/models.py`. Usano `model_config = ConfigDict(extra="ignore")` per compatibilità forward.

| Modello | Campi principali |
|---------|----------------|
| `Organization` | `id`, `name`, `invite_code`, `pseudonymized_mode` |
| `User` / `UserPublic` | `id`, `email`, `name`, `role`, `organization_id` |
| `Patient` | `id`, `codice_paziente`, `nome`, `cognome`, `anno_nascita`, `sesso`, `diagnosi`, `organization_id` + campi anamnestici estesi |
| `Assessment` | `id`, `patient_id`, `index_type`, `date`, `score`, `interpretation`, `inputs` (dict), `visit_id`, `visit_category`, `source_filename` |
| `Therapy` | `id`, `patient_id`, `drug_name`, `drug_canonical`, `category`, `status`, `start_date`, `end_date`, `indication`, `events[]` (TherapyEvent embedded) |
| `TherapyEvent` | `type` (started / dose_increased / dose_decreased / discontinued / noted / historical_exposure / regimen_changed), `date`, `dose`, `frequency_after`, `route_after`, `reason` |
| `LabExam` | `id`, `patient_id`, `date`, `panel` (required), `values` (dict param→valore), `source_filename` |
| `InstrumentalExam` | `id`, `patient_id`, `exam_date`, `exam_type`, `territory`, `result`, `summary`, `origin` (visione/archive/nuova) |
| `ClinicalEvent` | `id`, `patient_id`, `event_type`, `titolo`, `categoria`, `date_value`, `date_precision`, `drug_canonical`, `manifestation`, `reason`, `source_origin`, `confidence`, `inferred_by`, `updated_by`, `updated_at` |
| `WorkupVisit` | `id`, `patient_id`, `visit_date`, `visit_type`, sezioni narrative (anamnesi, esame obiettivo, conclusioni, `referral_note`, `home_therapies_text`, `comorbidities_text`) |
| `Condition` | `id`, `patient_id`, `label`, `canonical_name`, `category`, `status`, `onset_date`, `flags` |
| `DiseaseProfile` | `id`, `patient_id`, `disease_type`, `data` (JSON flessibile per-malattia) |
| `PROToken` | `id`, `patient_id`, `token`, `expires_at`, `instruments[]`, `submitted_at`, `responses` |
| `ConsultToken` | `id`, `patient_id`, `token`, `expires_at`, flag `include_*`, `note` |
| `Reminder` | `id`, `patient_id` (opzionale), `title`, `due_date`, `priority`, `completed`, `visibility` |

### Database MongoDB

**Collections e indici principali** (creati a startup in `server.py`):

| Collection | Indici notevoli |
|-----------|----------------|
| `users` | `email` (unique), `id` (unique) |
| `organizations` | `id` (unique), `invite_code` (unique) |
| `patients` | `organization_id` |
| `assessments` | `(patient_id, date)` desc |
| `therapies` | `patient_id` |
| `lab_exams` | `(patient_id, date)` desc |
| `instrumental_exams` | `(patient_id, date)` desc |
| `workup_visits` | `(patient_id, visit_date)` desc |
| `clinical_events` | `(patient_id, org_id, date_value)`, `(patient_id, event_type)`, `(patient_id, drug_canonical)`, `(patient_id, deleted_at)` |
| `conditions` | `(patient_id, canonical_name, organization_id)` (unique — per upsert dedup) |
| `disease_profiles` | `(patient_id, disease_type)` (unique) |
| `pro_tokens` | `token` (unique) |
| `consult_tokens` | `token` (unique) |

> **Convenzione chiavi**: tutti i documenti usano `id` (UUID stringa) come chiave applicativa, non `_id` MongoDB. Le query escludono sempre `{"_id": 0}`.

### Moduli condivisi

**`helpers.py`:**
- `verify_patient_in_org(patient_id, org_id)` — guard multi-tenant, sollevato su ogni endpoint paziente
- `_episode_state_at(episode, date)` — ricostruisce dose/freq/route di un episodio a una data specifica camminando sugli eventi embedded
- `_therapy_state_at(episodes, date)` — lista completa farmaci attivi a una data (usato da `GET .../therapies/state` e da auto-generazione `home_therapies_text`)
- `_format_therapy_snapshot(episodes)` — testo leggibile della terapia corrente (per report)

**`deidentify.py`:**
Rimuove CF, email, telefono, date di nascita, intestazioni ospedaliere, firme medico, nome/cognome dal testo prima di inviarlo a LLM.

**`lab_parser.py`:**
Pipeline server-side multi-tool: prova `pdfplumber` → `PyMuPDF` → `pytesseract` OCR. Regex per >50 parametri reumatologici con normalizzazione unità. Restituisce `{parameter, value, unit, reference_range, flag}` per ogni parametro trovato.

---

## 7. Frontend — React

### Routing applicativo

```
/login                    → Login.jsx           (solo se non autenticati)
/register                 → Register.jsx         (solo se non autenticati)
/pro/:token               → PublicPRO.jsx        (pubblico, no auth)
/c/:token                 → ConsultPage.jsx       (pubblico, no auth)
/                         → Dashboard.jsx
/pazienti                 → Patients.jsx
/pazienti/:id             → PatientDetail.jsx
/pazienti/:id/visita      → PatientQuickVisit.jsx
/pazienti/:id/prima-visita → FirstVisitPage.jsx
/pazienti/:id/visita-workup → WorkupVisitPage.jsx
/criteri                  → Criteria.jsx
/linee-guida              → Guidelines.jsx
/miscellanea              → Miscellanea.jsx
/privacy                  → Privacy.jsx
```

`AuthContext.jsx` gestisce lo stato auth globale. `ProtectedRoute` redirige al login se non autenticati. `PublicOnly` redirige alla home se già autenticati.

### Pagine principali

**`Dashboard.jsx`** — Ponte di comando clinico
- KPI: pazienti recenti (7 giorni), task attivi, pazienti in recall
- Gestione task clinici (standalone o collegati a paziente): urgenza, privacy flag, completamento
- Widget recall: pazienti flaggati per rivalutazione
- Widget pazienti recenti: accesso rapido alle ultime cartelle aperte

**`PatientDetail.jsx`** (~1700 righe) — Hub principale per il follow-up
Carica e orchestra tutto lo stato del paziente: terapie, assessments, lab, visite, profili malattia. Sezioni principali:
- `PatientHeader` + `StickyPatientHeader`: intestazione con dati anagrafici, bottoni import
- `PatientProfileStrip`: anamnesi fisiologica, allergie, comorbidità (legge `prima_visita.data`)
- `RheumatologicStatusStrip`: profilo reumatologico (diagnosi, anticorpi, manifestazioni)
- `ClinicalAlerts`: avvisi critici (interazioni farmacologiche, sicurezza)
- `ClassificationBadges`: criteri classificazione soddisfatti
- `TodayVisitSection`: sessione visita real-time con salvataggio strutturato
- `TrendChartCard`: andamento longitudinale score + barre terapie (Recharts)
- Dialog "Storico": `ClinicalTimelineManager` + storia visite + profili malattia-specifici
- `TherapySection`: terapie attive/storiche con safety reminders integrati
- `PlanSection`: piano clinico
- `RemindersSection`: promemoria paziente
- Profili malattia-specifici: caricati dinamicamente in base alla diagnosi

**`FirstVisitPage.jsx`** — Wizard 6 step per nuovi pazienti
1. Motivo di invio (categoria + quesito clinico)
2. Anamnesi extra-reumatologica (allergie, comorbidità con ricerca + sinonimi, fattori di fragilità)
3. Anamnesi reumatologica (narrativo + caratteristiche cliniche)
4. Esami portati in visione (lab + imaging)
5. Esame obiettivo (generale + articolare)
6. Conclusioni (ipotesi diagnostiche, livello certezza, modifiche terapeutiche)

Al termine: può "Convertire a Follow-up" aggiornando lo stato paziente e scrivendo le condizioni nel DB.

**`WorkupVisitPage.jsx`** — Visita di approfondimento diagnostico
Sezioni: Anamnesi, Esame Obiettivo, Conclusioni, Terapia domiciliare, Referral note. Usa `ClinicalCockpit` per il sommario contestuale. Può importare dati da prima visita o visite precedenti. Genera report PDF via `VisitReportDialog`.

> **WorkupVisitPage vs PatientDetail**: il primo è per pazienti ancora in fase diagnostica (pre-follow-up), il secondo per pazienti in follow-up cronico con diagnosi definitiva.

### Componenti per dominio

**`components/visits/`**
- `TodayVisitSection` — sessione visita real-time. Salva `WorkupVisit(visit_type:"follow_up")` PRIMA degli assessment, poi li collega via `visit_id`.
- `VisitImportButton` — entry point per tutto il flusso di import; gestisce mode `single` / `multi`
- `ImportVisitFromTextModal` — parser testo → review → salvataggio
- `ImportVisitPdfModal` — bridge PDF singolo → testo → `onTextExtracted`
- `ImportMultiPdfModal` — pipeline multi-PDF: un documento per file, mai concatenati
- `VisitReportDialog` — genera e visualizza report visita in formato clinico
- `ClinicalCockpit` — usato in `WorkupVisitPage`: sommario dati clinici in tempo reale

**`components/clinical/`**
- `ClinicalTimelineManager` — CRUD completo timeline raccordo: filtri per categoria, raggruppamento per anno, sezione "non datati", edit inline, merge mode (seleziona 2 eventi → fusione). Fetcha autonomamente i propri dati, riceve solo `patientId`.
- `AssessmentForm` — form per score singolo
- `CompositeAssessmentDialog` — form multi-score con riuso dati precedenti (`compositeReusePrev.js`)
- `TrendChartCard` — grafico longitudinale score + barre colorate terapie
- `PlanSection` — piano clinico strutturato

**`components/profiles/`** — Un componente per ogni diagnosi supportata:

| Componente | Diagnosi |
|-----------|----------|
| `RaProfileSection` | Artrite Reumatoide |
| `SpaProfileSection` | Spondiloartrite |
| `SleProfileSection` | Lupus Eritematoso Sistemico |
| `ScleroProfileSection` | Sclerosi Sistemica (SSc) — sola lettura, dati derivati |
| `AavProfileSection` | AAV (GPA, MPA, EGPA) |
| `IgaVProfileSection` | Vasculite IgA (IgAV/Schönlein-Henoch) |
| `BehcetProfileSection` | Malattia di Behçet (score ICBD 2014 live) |
| `CryoVasProfileSection` | Vasculite da crioglobulinemia |
| `UrticarialVasProfileSection` | Vasculite urticariale |
| `PanProfileSection` | Poliarterite Nodosa |
| `CsvvProfileSection` | Vasculite cutanea dei piccoli vasi |
| `AosdProfileSection` | Malattia di Still dell'adulto |
| `ApsProfileSection` | Sindrome da antifosfolipidi |
| `GoutProfileSection` | Gotta |
| `MctdProfileSection` | Connettivite mista (MCTD) |
| `Igg4RdProfileSection` | Malattia correlata a IgG4 |
| `RpcProfileSection` | Policondrite recidivante |
| `SjogrenProfileSection` | Sindrome di Sjögren |
| `MyositisProfileSection` | Miopatie infiammatorie |
| `PmrLvvProfileSection` | PMR / Vasculite dei grandi vasi (LVV) |

La selezione del profilo da mostrare è gestita da `lib/diseaseDetection.js`. Le diagnosi rare (IgAV, Behçet, vasculiti non-AAV) vengono testate PRIMA di `isAavDiagnosis` per evitare falsi positivi.

**`components/imaging/`**
- `Homunculus` — figurina articolare SVG interattiva (esame articolare AR/SpA)
- `MRSSHomunculus` — figurina per Modified Rodnan Skin Score (SSc)
- `VascularHomunculusDialog` — imaging vascolare per AAV/PMR/LVV
- `SpaJointsPanel` — pannello entesiti/dattilite/sacroileite (SpA)
- `EnthesisBodyChart` — mappa delle entesiti
- `EcodopplerDialog`, `AngioImagingDialog`, `EchoMskDialog` — dialog imaging specialistici

---

## 8. Clinical Engine (lib/)

Il cuore del sistema. Gira **interamente nel browser**, nessuna dipendenza cloud. Tutti i file sono JavaScript puro.

### visitTextParser.js

Parser a due passi per testi di visita in italiano (~2400 righe).

**Architettura:**
1. `normalizeImportedText()` — unifica header di sezione, rimuove boilerplate, segmenta sezioni
2. `parseVisitText()` — estrae farmaci (da `DRUG_ALIAS_MAP`), score (regex per DAS28/CDAI/ecc.), lab, diagnosi, sezioni narrative, profilo generale, referti strumentali, eventi raccordo

**Restituisce:**
```js
{
  extracted: {
    diagnosi, therapies, assessments, lab_results, visit_sections,
    profilo_generale, instrumental_findings, raccordo_events
  },
  parse_review: {
    unresolved: Number,     // item che richiedono revisione
    low_confidence: Number, // item estratti con bassa confidenza
    items: []               // lista dettagliata per SectionReviewPanel
  }
}
```

**Sezioni riconosciute:**
`ANAMNESI`, `TERAPIA_DOMICILIARE`, `ESAME_OBIETTIVO`, `ESAMI_PREGRESSI`, `ACCERTAMENTI`, `INDICAZIONI`, `ALLERGIE`, e varianti locali (es. `OBB?IETTIVAMENTE` per AUSL Bologna, `TERAPIA(?::|$)` per intestazioni inline).

### raccordoParser.js

Parser per il "raccordo anamnestico" — la sezione narrativa storica del paziente.

**Output:** array di `ClinicalEvent` con `event_type`, `drug_canonical`, `date_value`, `reason`, `confidence`, `inferred_by`.

**Regole principali:**

| Regola | Trigger | Output |
|--------|---------|--------|
| **Rule 0A** | `DAL_YEAR` + farmaco | `therapy_start` con data |
| **Rule 0B** | Farmaco isolato con data | `therapy_start` (verbo implicito) |
| **Rule 0C** | Frase-lista storica (`CLASS_LABEL_RE` o `HISTORY_VERB_RE`) senza verbo start esplicito | `therapy_start` per ogni farmaco |
| **Rule 1** | Verbi di esordio malattia | `disease_onset` / `manifestation_onset` |
| **Rule 2** | `DAL_YEAR_EXT_SRC` + farmaco | `therapy_start` con data precisa |
| **Rule 2b** | `START_VERB_RE` (avviato, iniziato, introdotto…) | `therapy_start` `inferred_by:"start_verb"` |
| **Rule 2b-restart** | `RESTART_VERB_RE` (ripresa terapia, ha ripreso, reintrodotto…) | `therapy_start` `inferred_by:"restart_verb"` |
| **Rule 2c** | `SWITCH_VERB_RE` (passato a, sostituito con…) | `therapy_stop` (fromDrug) + `therapy_start` (toDrug) `inferred_by:"switch_verb"` |
| **Rule 3** | `STOP_RE` (sospeso, interrotto…) — **loop globale multi-stop** | `therapy_stop` per ogni occorrenza |
| **Rule 4** | `SPACING_RE` (spacing a N settimane) | `dose_spacing` |
| **Rule 5** | `REMISSION_RE` / `FLARE_RE` | `remission` / `flare` |

**Guard importanti:**
- **Negation guard** (Rule 3): `\b(mai|non)\s*$` prima di ogni stop keyword → salta quell'occorrenza
- **`stopsEmitted` Set**: previene stop multipli per stesso farmaco nella stessa frase
- **`hasExplicitStart`** (Rule 0C): blocca la regola se la frase ha già un verbo start/restart o `dal YEAR`
- **`ANCILLARY_CANONICALS`** (folato, vitamina D, calcio, ecc.): sempre esclusi da eventi terapeutici

**Multi-stop (dettaglio implementazione):**
`STOP_RE` viene eseguito con `new RegExp(STOP_RE.source, "gi")` in un while-loop. Per ogni occorrenza: il drug viene cercato nella finestra **[-80 char, 0]** rispetto al match; la reason viene estratta nella finestra **[0, +80 char]**. Questo permette frasi come "Infliximab sospeso per gravidanza, Adalimumab sospeso per evento avverso" di generare due stop separati.

**Metriche correnti (TC1-TC15):**
TP=76, FP=0, FN=15, Macro-F1=0.895, Precision=1.000. Audit: `bash poc/build.sh && node poc/audit_parser_live.js`.

### visitReconciler.js

`reconcileDrafts(drafts[], existingData)` — confronta N draft importati con lo storico DB.

**Annota ogni item con `_status`:**
- `new` — non presente nel DB
- `duplicate` — identico a uno già esistente
- `continued` — stesso farmaco attivo, nessun conflitto (solo `relevance: high`)
- `conflict` — stesso farmaco ma dati divergenti

I farmaci `continued` con `relevance: high` ricevono `_call_upsert: true` → `_applyOneDraft()` chiama l'upsert per aggiornare l'episodio attivo.

> **Attenzione**: usa sempre `.listByPatient()` (mai `.list()` che non esiste su questi API — restituirebbe `[]` silenziosi).

### clinimetrics.js

Calcolo client-side di 15+ indici clinimetrici:

| Indice | Malattia | Input |
|--------|----------|-------|
| DAS28-ESR / DAS28-CRP | AR | TJC28, SJC28, VAS/GH, VES o CRP |
| CDAI | AR | TJC28, SJC28, PGA, EGA |
| SDAI | AR | Come CDAI + CRP |
| BASDAI | SpA | 6 item (scala 0-10) |
| ASDAS-CRP / ASDAS-ESR | SpA | BASDAI item + CRP o VES |
| SLEDAI-2K | LES | 24 item weighted |
| ECLAM | LES | Alternativa SLEDAI |
| mHAQ / HAQ-DI | AR/generica | 8 categorie ADL |
| DAPSA | APs | TJC66, SJC68, VAS dolore, VAS globale, CRP |
| RAPID3 | Generica | 3 item PRO |
| mRSS | SSc | Skin score 0-51 |
| Oxford IgAV | IgAV | Score biopsia |
| ICBD Behçet 2014 | Behçet | Criteri classificazione (score ≥4 = diagnosi) |
| ESSDAI | Sjögren | 12 domini weighted |
| PASI | Psoriasi | 4 aree corporee |

Ogni indice restituisce `{ score, interpretation, details }` con soglie cliniche (remissione, bassa/media/alta attività).

### labValueExtractor.js

`extractLabValuesByDate(text)` — estrae valori lab con data da testo libero italiano.

**3-pass per le date:**
1. `DATE_HEADER_RE`: date come intestazione `(4/1/22)`, `(agosto 2025)`
2. Formato ISO `YYYY-MM-DD`
3. Formato italiano `DD/MM/YYYY`

**Gestisce:**
- Alias per parametro canonico (es. "VES" → `esr`, "PCR" → `crp`)
- PCR: default **mg/dL** (mai mg/L — nessuna conversione implicita)
- Pattern qualitativi (pos/neg, ±) per anticorpi
- `HIGH_RISK_KEYS` → aggiunge item in `lab_review_items` quando l'unità è inferita

**Regola chiave:** la chiave canonica è sempre `param_key`, non il nome display. In `VisitImportButton`: `r.param_key || toCanonicalLabKey(r.name)`.

### Altri moduli lib/

| File | Funzione |
|------|---------|
| `drugs.js` | `DRUG_ALIAS_MAP`: ~160 farmaci + alias IT. Sorgente unica di verità. |
| `drugInteractions.js` | Interazioni farmacologiche reumatologiche (knowledge base) |
| `safetyReminders.js` | Checklist sicurezza per-farmaco: monitoraggio emocromo (MTX), controindicazioni gravidanza (MTX/LEF/MMF), ecc. |
| `diseaseDetection.js` | `isRaDiagnosis()`, `isSpaDiagnosis()`, ecc. — cascade per selezionare il profilo malattia corretto |
| `conditions.js` | `COMORBIDITY_CATEGORIES` con ~60 condizioni e sinonimi canonici |
| `criteria.js` | Criteri classificazione ACR/EULAR (AR, SpA, LES, AAV, APS, Gotta, ecc.) |
| `steroidTapering.js` | Generatore piani di tapering steroideo con calcolo combinazioni ottimali di compresse |
| `biologicCalendar.js` | Calendario somministrazioni bDMARD per spaziature variabili |
| `export.js` | Generazione report PDF clinici via jsPDF; `fmtComorbForReport()` merga allergie + comorbidità con dedup |
| `importPayloadBuilders.js` | Trasforma output parser in payload pronti per le API |
| `instrumentalParser.js` | Parser referti strumentali: separa archivio da esami correnti |
| `instrumentalFormatters.js` | Formattatori narrativi per referti imaging complessi (PET/TC, ecc.) |
| `therapyPresets.js` | Template terapeutici per condizione |
| `therapySuggestions.js` | Suggerimenti T2T (Treat-to-Target) basati su score |
| `guidelines.js` | Riferimenti linee guida EULAR/ACR integrati nell'UI |
| `proInstruments.js` | Definizioni strumenti PRO (HAQ, BASDAI, RAPID3…) con logica di scoring |
| `firstVisitData.js` / `firstVisitReport.js` | Struttura dati e formattazione report prima visita |
| `pdfDeidentifier.js` | `stripDemographics()` — de-identificazione lato client da testo PDF |
| `pdfLabExtractor.js` | `extractTextFromPdf()` via pdf.js con interval-merging per testo a colonne |

---

## 9. Pipeline di importazione

Il flusso di import è il percorso critico del prodotto. Tre modalità:

### Singolo testo (`VisitImportButton` mode: `single`)

```
Input testo
  → visitTextParser.parseVisitText()
  → SectionReviewPanel (se parse_review.unresolved > 0 o low_confidence > 0)
  → buildEditableDraft()     # stampa _id (UUID) e _skip:false su ogni array item
  → UI review (utente può de-selezionare item con toggle _skip)
  → _applyOneDraft()         # filtra !_skip, chiama API
```

### Singolo PDF

```
ImportVisitPdfModal
  → pdfLabExtractor.extractTextFromPdf()   # estrae testo da PDF (interval-merging per colonne)
  → pdfDeidentifier.stripDemographics()    # rimuove anagrafica localmente
  → detectVisitDate()                       # estrae data visita dal testo
  → onTextExtracted({ text, date })
  → [continua come singolo testo]
```

### Multi-PDF (`ImportMultiPdfModal`)

```
Per ogni file PDF:
  → extractTextFromPdf() → stripDemographics() → detectVisitDate()
  → [{ id, text, date, filename }]

→ VisitImportButton (mode: multi)
  → MultiVisitInput (blocchi pre-popolati, uno per PDF)
  → parseMulti()
      → allSettled: fetcha therapies, assessments, lab_exams esistenti
      → reconcileDrafts()   # annota ogni item con _status
  → MultiVisitWizard        # review con badge _status (new/continued/conflict/duplicate)
  → applyMulti()            # chiama _applyOneDraft() per ogni draft in sequenza
```

**Regola fondamentale:** ogni PDF/lettera è SEMPRE un documento separato. Mai concatenare testi di visite diverse.

### SectionReviewPanel

Intercetta il flusso quando `_parse_review.unresolved > 0` o `low_confidence > 0`. Permette la revisione manuale prima del salvataggio. I 4 segnali che attivano la review:
1. Farmaco trovato senza contesto temporale
2. Parametro lab con unità inferita (`HIGH_RISK_KEYS`)
3. Data visita estratta da pattern di ultimo ricorso (RE3)
4. Sezione clinica con contenuto ambiguo

### Traceability

Ogni entità importata da PDF porta `source_filename` nel DB:

| Collection | Campi |
|-----------|------|
| `assessments` | `source_filename` |
| `lab_exams` | `source_filename` |
| `clinical_events` | `source_filename`, `source_origin`, `source_section` |

---

## 10. Sistema PRO (Patient-Reported Outcomes)

**Flusso completo:**
1. Il medico genera un token PRO: `POST /api/pro-tokens` con `{ instruments[], expires_in_days }` → riceve URL + QR code
2. Il paziente accede a `/pro/:token` (no auth, `PublicPRO.jsx`) via link o QR
3. Compila i questionari selezionati — scoring in tempo reale lato client via `proInstruments.js`
4. Invia: `POST /api/public/pro/:token/submit`
5. Il medico vede le risposte nel dashboard; può convertire in Assessment formale: `POST /api/pro-tokens/:id/convert`

**Strumenti disponibili:** HAQ-DI, mHAQ, BASDAI, RAPID3, e altri. Definiti in `lib/proInstruments.js` con items, scale, e logica di scoring.

---

## 11. Consulto e link condivisione

Genera un link read-only pseudonimizzato con scadenza configurabile per revisione esterna (colleghi, centri di riferimento). Nessun login richiesto per il destinatario.

**Flusso:**
1. Medico crea link: `POST /api/patients/:id/consult-token` con `{ expires_in_days, include_therapies, include_assessments, include_labs, include_criteria, note }`
2. Destinatario accede a `/c/:token` (`ConsultPage.jsx`, no auth)
3. Vista read-only: nome paziente pseudonimizzato, dati clinici selezionati dal mittente
4. Revoca: `DELETE /api/consult-tokens/:id`

---

## 12. Export e reportistica

**Export dati (backend, tutti richiedono auth):**
- `/export/json` — dump JSON completo org (tutti i pazienti)
- `/export/csv-zip` — ZIP con CSV per ogni collection
- `/export/cohort-xlsx` — XLSX multi-sheet: anagrafica, diagnosi, terapie, lab (una riga per paziente)
- `/export/diagnoses` e `/export/drugs` — aggregati per analytics

**Report clinici (frontend, jsPDF):**
- `VisitReportDialog` — report visita corrente (WorkupVisit), include terapia al momento della visita
- `HistoryExportDialog` — export storia clinica longitudinale
- `export.js` — formattatori: `fmtComorbForReport(data, fvData)` merga allergie + comorbidità con dedup case-insensitive

> `home_therapies_text` nelle WorkupVisit viene auto-generato al momento della **creazione** della visita tramite `_therapy_state_at()` (snapshot immutabile). Se non ci sono terapie attive, cade back al testo manuale.

---

## 13. Privacy by Design

**Livello 1 — Client-side (sempre attivo):**
- `pdfDeidentifier.stripDemographics()`: rimuove CF, email, telefono, date di nascita, intestazioni AUSL, firme medico, nome/cognome dal testo estratto da PDF prima di qualsiasi elaborazione
- Il parsing è interamente deterministico e locale — nessun dato viaggia verso cloud per il parsing standard

**Livello 2 — Pre-LLM (solo se AI parsing abilitato dall'org):**
- `deidentify.py` lato server: ulteriori pattern di rimozione PII prima di inviare il testo a Claude/Gemini
- Attivabile per org dall'admin tramite `PUT /api/organization/settings { ai_parsing_enabled: true }`

**Livello 3 — Pseudonimizzazione pazienti:**
- `POST /api/patients/:id/anonymize`: rimuove nome, cognome, CF sostituendoli con pseudonimo
- Modalità org-wide (`pseudonymized_mode`): i nuovi pazienti vengono registrati già pseudonimizzati

---

## 14. Pattern architetturali chiave

### Episode model (Terapie)
Un documento in `db.therapies` = un episodio terapeutico. La sospensione chiude **sempre** l'episodio corrente. Un riavvio crea un **nuovo documento**. Gli eventi (dose change, sospensione, ecc.) sono nell'array embedded `events[]`. L'upsert intelligente (`POST /therapies/upsert`) gestisce: continuità (stessa dose), dose change, riavvio, switch.

```
Episodio 1:  started(2015) → dose_increased(2016) → discontinued(2018, motivo: inefficacia)
Episodio 2:  started(2020) → [attivo]
```

### Import draft pattern
`buildEditableDraft()` stampa `_id` (UUID) e `_skip: false` su ogni item di ogni array nel draft. L'UI permette all'utente di de-selezionare item (toggle `_skip`). `_applyOneDraft()` filtra su `!item._skip` prima di chiamare le API.

**Non modificare questo contratto** — è il confine tra parser e UI di review.

### Therapy state at point-in-time
`GET /api/patients/:id/therapies/state?date=YYYY-MM-DD` ricostruisce la lista farmaci attivi in quella data camminando sugli eventi embedded di ogni episodio (`_episode_state_at`). Usato per:
- Auto-generazione di `home_therapies_text` alla creazione di WorkupVisit (snapshot immutabile)
- Report storici
- Export coorte

### DRUG_ALIAS_MAP — Single Source of Truth
`lib/drugs.js` è la **sola** sorgente di verità per farmaci e alias. Tutti i parser importano questa mappa. Per aggiungere un farmaco: modifica **solo `drugs.js`**. Non duplicare la lista altrove.

### ClinicalTimelineManager — autonomia fetch
Il componente fetcha i propri dati autonomamente. Riceve solo `patientId`. Non dipende dallo stato del parent per i clinical events — questo lo rende riutilizzabile senza contaminare lo stato di `PatientDetail`.

### Privacy dei parametri lab
PCR: default **mg/dL** (non mg/L). **Nessuna conversione implicita** tra unità. Se l'unità è inferita su `HIGH_RISK_KEYS`, viene aggiunto un item in `lab_review_items` per revisione manuale prima del salvataggio.

### Raccordo multi-stop
`STOP_RE` viene eseguito con `new RegExp(STOP_RE.source, "gi")` in un while-loop. Per ogni occorrenza: drug nella finestra [-80, 0] e reason nella finestra [0, +80]. `stopsEmitted` Set previene duplicati nella stessa frase. Permette "Infliximab sospeso per gravidanza, Adalimumab sospeso per evento avverso" → 2 stop separati.

### Soft delete
Tutti i `DELETE` sono logici: stampano `deleted_at` timestamp. Le query di lista filtrano sempre su `"deleted_at": None`.

### UUID come ID applicativo
Tutti i documenti usano `id` (UUID v4 stringa) come chiave applicativa, non `_id` MongoDB. Le query escludono sempre `{"_id": 0}` dalle risposte.

---

## 15. Test e POC

**Test unitari frontend (Jest, `yarn test`):**
```
frontend/src/__tests__/
├── visitTextParser.test.js
├── labValueExtractor.test.js
└── clinimetryTextParser.test.js
frontend/src/lib/__tests__/
├── import_field_mapping.js
└── parser_regression.js
```

**Audit raccordoParser (Node.js, esterno a Jest):**
```bash
bash poc/build.sh               # Compila raccordoParser.js in /tmp/raccordo_bundle.cjs
node poc/audit_parser_live.js   # Audit TC1-TC15: TP/FP/FN/F1 per sprint
```

Output salvato in `poc/results/<timestamp>/`:
- `audit_results.json` — dettaglio per test case
- `audit_results.csv` — tabella per analisi
- `audit_report.md` — report leggibile con metriche aggregate

---

## 16. Convenzioni di sviluppo

- **Lingua UI e commenti**: italiano
- **Nessun commento** nel codice salvo richiesta esplicita
- **Nessuna emoji** nei file
- **Struttura a file esistente**: non creare file extra. I componenti seguono la struttura per dominio esistente.
- **DRUG_ALIAS_MAP**: modificare solo `drugs.js`. Mai duplicare la lista farmaci altrove.
- **Parsing deterministico prima di AI**: il parsing locale ha sempre la precedenza. L'AI è fallback opzionale per l'org.
- **`extra="ignore"` su tutti i modelli Pydantic**: per compatibilità forward con nuovi campi.
- **Tutti gli endpoint Axios in `lib/api.js`**: nessuna chiamata axios diretta nei componenti.
- **Chiave canonica lab**: sempre `param_key` (non il nome display). Usare `toCanonicalLabKey()` come fallback.
- **Multi-tenant guard**: ogni endpoint che accede a dati paziente chiama `verify_patient_in_org`.
- **Soft delete**: i `DELETE` sono logici (`deleted_at` timestamp). Mai rimozione fisica.
- **UUID come ID applicativo**: `id` UUID stringa su tutti i documenti. Escludere sempre `_id` MongoDB con `{"_id": 0}`.
- **Cookie httpOnly per JWT**: non usare localStorage. L'interceptor Axios gestisce il refresh automatico su 401.
- **`listByPatient()` nei reconciler**: mai `.list()` sulle API therapies/assessments/labExams — non esiste e restituisce silenziosamente `[]`.
