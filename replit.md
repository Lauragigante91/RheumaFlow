# RheumaFlow — Regole di progetto

> Workspace clinico multi-tenant per reumatologi: gestione longitudinale dei pazienti, clinimetria real-time, importazione deterministica da lettere di visita e referti PDF. Privacy by design.

Questo file contiene **solo le regole attive** per lo sviluppo. Il riferimento tecnico esteso (stack, struttura repo, router, modelli, pagine, Clinical Engine, pipeline) è in `README.md`. Le decisioni architetturali con il relativo razionale sono in `docs/decisions/`.

---

## Principi fondamentali

- **Privacy by design**: il parsing avviene lato client e deterministico; l'anagrafica viene rimossa localmente prima di qualsiasi elaborazione e prima di qualunque chiamata AI opzionale. Dettaglio: `docs/decisions/0002-privacy-by-design-layering.md`.
- **Parsing deterministico prima dell'AI**: tutto ciò che è estraibile via regex/logica deterministica lo è; l'AI (Claude/Gemini) è solo un fallback opzionale, abilitabile per organizzazione e sempre dietro de-identificazione. Dettaglio: `docs/decisions/0001-parsing-deterministico-prima-ai.md`.
- **Multi-tenancy**: ogni organizzazione (UO) è isolata tramite `organization_id`; nessun paziente è visibile da un'altra UO. Dettaglio: `docs/decisions/0003-multi-tenancy-organization-id.md`.
- **Architettura a episodi**: le terapie sono episodi con eventi embedded (non record piatti), il che consente la ricostruzione point-in-time dello stato terapeutico a qualsiasi data. Dettaglio: `docs/decisions/0004-modello-episodi-terapie.md`.

---

## Avvio locale e variabili d'ambiente

```bash
bash start.sh          # Avvia FastAPI (8000) + React dev server (5000)
```

In sviluppo FastAPI fa da proxy/SPA fallback verso React; in produzione (`frontend/build/` presente) serve i file statici.

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

## Convenzioni di sviluppo

- Lingua di UI, chat e commenti: **italiano**. Nessun commento nel codice salvo richiesta esplicita. Nessuna emoji.
- Mantenere la struttura a file esistente; non creare file extra non necessari.
- Parsing deterministico locale **sempre** prima dell'AI (`docs/decisions/0001`).
- Tutti i modelli Pydantic con `extra="ignore"`. Tutte le chiamate HTTP via `lib/api.js`.
- Chiave canonica lab sempre `param_key` (fallback `toCanonicalLabKey()`); PCR default mg/dL, nessuna conversione implicita (`docs/decisions/0009`).
- `verify_patient_in_org` su ogni endpoint paziente (`docs/decisions/0003`).
- Soft delete (`deleted_at`) e UUID come ID applicativo ovunque (`docs/decisions/0006`).
- Nuovi farmaci/alias **solo** in `drugs.js` (`DRUG_ALIAS_MAP`) (`docs/decisions/0007`).
- Terapie: modello a episodi; scritture longitudinali via `upsert`/projection helper, mai update in place che rompe il ledger eventi (`docs/decisions/0004`, `0005`).
- Import: contratto draft (`_skip`/`_id`), un documento per PDF/lettera, reconciler usa sempre `.listByPatient()` (`docs/decisions/0008`).

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
  Output in `poc/results/<timestamp>/` (JSON, CSV, report md).

---

## User preferences

- Lingua delle UI e dei commenti nel codice: **italiano**
- Nessun commento nei file a meno che non sia esplicitamente richiesto
- Nessuna emoji nei file
- Mantenere la struttura a file esistente (non creare file extra non necessari)
- Il parsing deterministico locale ha sempre la precedenza sul parsing AI
