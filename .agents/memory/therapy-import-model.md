---
name: Therapy import clinical model
description: Two-track therapy import + unified therapy_courses data model. Doctor always validates before saving.
---

## Principio architetturale — Modello terapia unificato

**Tutte le linee terapeutiche del paziente vivono in un unico spazio: `PATIENT → therapy_courses`.**

Non esistono terapie "reumatologiche" vs. "non reumatologiche" a livello di data model.
La distinzione è solo nella UI (RheumaFlow evidenzia/filtra le terapie di competenza reumatologica)
e nel parser (propone le reumatologiche per import strutturato).

**Motivo clinico:**
Le interazioni farmacologiche nascono dal confronto tra linee terapeutiche contemporanee
di qualsiasi origine. Esempio critico:
- Azatioprina (reumatologo) + Allopurinolo (MMG) → interazione grave
Il controllo interazioni (`interaction_check`) deve confrontare TUTTE le `therapy_courses`
attive o con date sovrapposte, indipendentemente dalla specialità che le ha prescritte.

**Conseguenze sul data model (da rispettare nelle prossime implementazioni):**
- `therapy_courses` è flat, senza campo `specialty` come discriminante di storage
- `category` (csDMARD/bDMARD/other/supportive) è un attributo, non un silo
- La UI può filtrare per category per mostrare le terapie reumatologiche, ma il DB le
  contiene tutte nello stesso posto
- `interaction_check` usa tutte le therapy_courses attive del paziente come input

**Stato attuale (da non confondere con il principio):**
Il filtro `RHEUM_CATEGORIES` in `visitTextParser.js` serve solo a decidere quali farmaci
*proporre per import strutturato*. Non implica che i farmaci `other`/`supportive` non
debbano vivere in `therapy_courses` — devono esserci, ma inseriti manualmente o tramite
flussi futuri (import MMG, reconciliazione farmacologica, ecc.).

---

## Two-track import (stato implementato)

**Track 1 — free text (all drugs):**
`S.TERAPIA_DOMICILIARE` raw section text → `profilo_generale.terapia_domiciliare` → saved to `patients.terapia_domiciliare`.
Includes everything: Ramipril, Amlodipina, MTX, Prednisone, Pantoprazolo, Dibase, Acido folico.

**Track 2 — structured therapies (rheumatologic proposed for import):**
`extractTherapies()` output filtered to: `csDMARD`, `bDMARD`, `tsDMARD`, `glucocorticoid`, `NSAID`.
Excluded from *import proposal*: `other` (Amlodipina, Losartan), `supportive` (PPIs, Vit D, Calcio, Acido folico).
Filter lives in `visitTextParser.js` after `extractTherapies()` call.
**This filter is about import UX, not about which drugs belong in therapy_courses.**

**Validation:**
All structured proposals have `_skip: false` (shown for review). Doctor must click "Conferma importazione". Nothing saves automatically.

---

## How to apply

- New drug category added to `DRUG_ALIAS_MAP`: decide if it's reumatologically relevant for
  *import proposals* → if yes, add category to `RHEUM_CATEGORIES` in visitTextParser.js.
- Implementing `interaction_check`: query ALL `therapy_courses` for the patient regardless of category.
- Implementing full therapy reconciliation (MMG import, etc.): all drugs → same `therapy_courses` table.
