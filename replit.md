# RheumaFlow — README Tecnico

## Panoramica

RheumaFlow è un workspace clinico specializzato per reumatologi, progettato per la gestione longitudinale dei pazienti, il calcolo clinimetrico real-time e l'importazione strutturata di dati da lettere di visita e referti PDF. L'architettura prioritizza la **privacy by design**: il parsing dei testi avviene interamente lato client (deterministico, zero cloud) e i dati anagrafici vengono rimossi prima di qualsiasi chiamata AI.

---

## Stack tecnologico

| Layer | Tecnologia |
|-------|-----------|
| **Frontend** | React 19, Create React App + CRACO, Tailwind CSS, Radix UI (shadcn/ui), Lucide React, Recharts |
| **Backend** | FastAPI (Python 3.11), Uvicorn ASGI |
| **Database** | MongoDB Atlas, Motor (driver async) |
| **AI / LLM** | Claude 3 Haiku (via LiteLLM), Gemini 2.0 Flash (fallback multimodale) |
| **Auth** | JWT con cookie `httpOnly` (access + refresh), bcrypt |
| **PDF parsing** | pdf.js lato client, de-identificazione locale |

Porta dev: React su **5000**, FastAPI su **8000**.

---

## Struttura repository

```
/
├── backend/
│   ├── server.py               # Entry point FastAPI (≈210 righe, solo routing e startup)
│   ├── models.py               # Pydantic v2 — tutti i modelli request/response/DB
│   ├── helpers.py              # verify_patient_in_org, logica terapie condivisa
│   ├── deidentify.py           # Rimozione anagrafica prima delle chiamate AI
│   ├── lab_parser.py           # Parser regex locale per report di laboratorio (IT)
│   └── routers/                # 9 domain router separati
│       ├── auth.py             # Login, refresh, register, invite
│       ├── patients.py         # CRUD paziente + pseudonimizzazione
│       ├── assessments.py      # Score clinimetrici
│       ├── lab_exams.py        # Archivio esami ematochimici
│       ├── therapies.py        # Episodi terapeutici con eventi embedded
│       ├── clinical_events.py  # Timeline raccordo (batchCreate, PATCH)
│       ├── workup_visits.py    # Visite documentate
│       ├── instrumental_exams.py
│       └── ai.py               # Endpoint per parsing assistito da LLM
│
├── frontend/src/
│   ├── pages/
│   │   ├── PatientDetail.jsx   # Hub paziente (~2100 righe) — orchestratore stato
│   │   ├── Dashboard.jsx
│   │   └── WorkupVisitPage.jsx
│   ├── components/
│   │   ├── layout/
│   │   │   └── PatientHeader.jsx       # Header con bottoni import
│   │   ├── visits/
│   │   │   ├── VisitImportButton.jsx   # Parser multi-visita (testo + PDF)
│   │   │   ├── ImportVisitPdfModal.jsx # Bridge singolo PDF → testo
│   │   │   ├── ImportMultiPdfModal.jsx # Pipeline multi-PDF (un doc per PDF)
│   │   │   └── ClinicalCockpit.jsx     # UI visita real-time
│   │   ├── clinical/
│   │   │   └── ClinicalTimelineManager.jsx  # CRUD timeline raccordo
│   │   └── patient/
│   │       ├── PatientProfileStrip.jsx
│   │       └── RheumatologicStatusStrip.jsx
│   └── lib/                    # "Clinical Engine" — puro JS, zero dipendenze cloud
│       ├── visitTextParser.js          # Parser deterministico principale (~2400 righe)
│       ├── visitReconciler.js          # Riconciliazione multi-visita con storico DB
│       ├── clinimetrics.js             # 15+ indici (DAS28, CDAI, BASDAI, SLEDAI-2K…)
│       ├── labValueExtractor.js        # Estrazione valori lab da testo libero
│       ├── pdfLabExtractor.js          # Estrazione testo da PDF via pdf.js
│       ├── pdfDeidentifier.js          # Rimozione anagrafica da testo estratto
│       ├── drugs.js                    # DRUG_ALIAS_MAP — ~160 farmaci + alias IT
│       ├── api.js                      # Tutti gli endpoint Axios (con retry/interceptor)
│       └── diagnosisSuggestions.js     # Suggerimenti diagnosi per codice ICD
```

---

## Architettura multi-tenant

Ogni operazione DB è filtrata per `organization_id`. Il dependency `verify_patient_in_org` in `helpers.py` garantisce che nessun paziente di una UO sia visibile da un'altra.

**Livelli di accesso:**
- `PLATFORM_ACCESS_CODE` — crea una nuova organizzazione (UO)
- `Invite Code` — aggiunge colleghi a una UO esistente
- `Admin` — gestisce impostazioni UO (pseudonimizzazione, privacy AI, invite code)
- `Member` — accesso clinico completo

---

## Clinical Engine (lib/)

Il cuore del sistema è una libreria JS deterministica che gira interamente nel browser:

### visitTextParser.js
Parser a due passi per testi di visita in italiano:
1. **Normalizzazione** — unifica header, rimuove boilerplate, segmenta sezioni
2. **Estrazione** — farmaci (DRUG_ALIAS_MAP), score (regex per DAS28/CDAI/etc.), lab, diagnosi, sezioni narrative

Restituisce `{ extracted, parse_review }`. Il campo `_parse_review` segnala item con bassa confidenza per la review manuale.

### visitReconciler.js
`reconcileDrafts(drafts[], existingData)` — confronta N draft con lo storico del paziente e annota ogni item con `_status` (new/continued/conflict/duplicate). I farmaci "high-relevance" continuati ricevono `_call_upsert: true`.

### DRUG_ALIAS_MAP (drugs.js)
Sorgente unica di verità per farmaci e alias. Tutti e tre i parser (visitTextParser, labValueExtractor, normalizer) derivano da questa mappa. Per aggiungere un farmaco nuovo: modificare solo `drugs.js`.

### clinimetrics.js
Calcolo client-side di 15+ indici: DAS28-ESR/CRP, CDAI, SDAI, BASDAI, ASDAS, SLEDAI-2K, ECLAM, mHAQ, HAQ-DI, DAPSA, RAPID3, mRSS, Oxford IgAV, ICBD Behçet, e altri.

### labValueExtractor.js
`extractLabValuesByDate()` — estrae valori con data da testo libero, gestisce alias per parametro canonico, regole di unità (PCR default mg/dL), pattern qualitativi (pos/neg).

---

## Pipeline import multi-documento

### Singolo PDF
`ImportVisitPdfModal` → `extractTextFromPdf` → `stripDemographics` → `detectVisitDate` → `onTextExtracted({text, date})` → `VisitImportButton` (mode: single)

### Multi-PDF
`ImportMultiPdfModal` → per ogni file: `extractTextFromPdf` → `stripDemographics` → `detectVisitDate` → `onMultiExtracted([{id, text, date, filename}])` → `VisitImportButton` (mode: multi, blocchi pre-popolati)

### Multi-testo (lettere multiple)
`VisitImportButton` (mode: multi) → `MultiVisitInput` → `parseMulti()` → `reconcileDrafts()` → `MultiVisitWizard` (review) → `applyMulti()` → N chiamate a `_applyOneDraft()`

**Regola**: ogni PDF/lettera è sempre un documento separato, mai concatenati.

### Traceability
Ogni entità importata da PDF porta `source_filename` nel DB:

| Modello | Campo |
|---------|-------|
| `AssessmentBase` | `source_filename` |
| `LabExamBase` | `source_filename` |
| `ClinicalEventBase` | `source_filename` (+ `source_origin`, `source_section`) |

---

## Modelli principali (models.py)

```python
Patient           # Anagrafica + profilo clinico (pseudonimizzabile)
Therapy           # Episodio terapeutico con events[] embedded
Assessment        # Score clinimetrico con inputs, score, interpretation
LabExam           # Valori ematochimici per data (panel + values dict)
ClinicalEvent     # Evento timeline raccordo (malattia/terapia/diagnosi/…)
WorkupVisit       # Visita documentata con sezioni narrative
InstrumentalExam  # Esame strumentale (ECO, RX, TAC, RM, capillaroscopia…)
DiseaseProfile    # Profilo malattia specifico (RA/SpA/SLE/SSc/IgAV/…)
```

Tutti i modelli usano `extra="ignore"` per compatibilità forward con nuovi campi.

---

## Pattern architetturali chiave

### Episode model (terapie)
Un documento in `db.therapies` = un episodio. La sospensione chiude sempre l'episodio corrente; un riavvio crea un nuovo documento. Il metodo `upsert` gestisce continuità, dose-change e switch.

### Import draft pattern
`buildEditableDraft()` stampa `_id` e `_skip: false` su ogni array item. L'UI permette all'utente di deselezionare item prima della conferma. `_applyOneDraft()` filtra su `!_skip`.

### SectionReviewPanel
Intercetta il flusso di import quando `_parse_review.unresolved > 0` o ci sono item `low_confidence`, permettendo review manuale prima del salvataggio.

### Privacy by design
1. `stripDemographics()` rimuove nome/CF/email/telefono dal testo estratto
2. Il testo de-identificato raggiunge Claude/Gemini solo se l'org ha abilitato l'AI parsing
3. Il parsing deterministico (locale) è sempre disponibile come fallback completo

---

## Sistema PRO (Patient-Reported Outcomes)

Il backend genera token JWT firmati con scadenza (`tokens.py`). Il paziente riceve un QR code che apre una pagina pubblica per compilare HAQ, BASDAI e altri PRO. I risultati vengono automaticamente associati al paziente e visibili in dashboard.

---

## Consulto / Link condivisione

Genera link read-only con scadenza configurabile per revisione esterna (colleghi, centri di riferimento). Nessun login richiesto per il destinatario; accesso limitato ai dati esplicitamente inclusi nella condivisione.

---

## ClinicalTimelineManager

Componente CRUD smart per la "cronologia raccordo" (timeline longitudinale del paziente):
- Fetch autonomo per `patientId`
- Raggruppamento per anno (eventi datati) + sezione "non datati"
- Filter tab per `categoria` (malattia/terapia/diagnosi/esame/ricovero/altro)
- Edit inline per riga
- Merge mode: selezione di 2 eventi → fusione
- Backend stampa automaticamente `updated_by` / `updated_at` su PATCH

---

## Avvio locale

```bash
bash start.sh          # Avvia FastAPI (8000) + React dev server (5000)
```

Variabili d'ambiente richieste: `MONGO_URL`, `JWT_SECRET`, `PLATFORM_ACCESS_CODE`.

Opzionali per AI parsing: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`.

---

## User preferences

- Lingua delle UI e dei commenti nel codice: **italiano**
- Nessun commento nei file a meno che non sia esplicitamente richiesto
- Nessuna emoji nei file
- Mantenere la struttura a file esistente (non creare file extra non necessari)
- Il parsing deterministico locale ha sempre la precedenza sul parsing AI
