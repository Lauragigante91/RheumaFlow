---
name: Multi-PDF import overwrite bugs
description: 3 bug di sovrascrittura dati in _applyOneDraft / applyMulti identificati e corretti
---

## Regola
Ogni scrittura in `_applyOneDraft` su campi "globali" del paziente (comorbidita_apr, allergie_testo, anamnesi_*) deve essere idempotente e additiva — mai cieca sovrascrittura.

## Bug corretti (VisitImportButton.jsx)

### Bug 1 — doppia scrittura interna allo stesso draft
Il blocco `profilo_generale` scriveva `comorbidita_apr` e `allergie_testo`, poi le sezioni dedicate (`comorbidita` / `intolleranze`) le sovrascrivevano con dati meno completi (array parsed vs. testo libero).

**Fix:** Il blocco `profilo_generale` salta `comorbidita_apr`/`allergie_testo` se la sezione strutturata ha item `!_skip` confermati:
```js
const _hasComorbItems = (extracted.comorbidita || []).filter(x => !x._skip).length > 0;
if (pg.comorbidita_apr && !_hasComorbItems) patch.comorbidita_apr = pg.comorbidita_apr;
```

### Bug 2 — riferimento stale al `patient` in `applyMulti`
Tutti i draft ricevevano lo stesso oggetto `patient` originale (prop React, mai aggiornato). Draft 2 non vedeva le scritture di Draft 1.

**Fix:** In `applyMulti`, si mantiene `currentPatient` e si re-fetcha da `patientsApi.get(patient.id)` tra un draft e il successivo.

### Bug 3 — comorbidita / intolleranze: overwrite invece di merge
Le sezioni dedicate sostituivano il testo esistente con i soli item del draft corrente.

**Fix:** Merge con dedup case-insensitive: solo item non già presenti vengono accodati.

## Regola "latest chronological wins" (CONFERMATA dall'utente)

In `applyMulti` i draft vengono ordinati per `visit_date` crescente prima del loop.
Il documento più recente viene applicato per ultimo → i suoi valori sovrascrivono quelli
dei documenti precedenti per tutti i campi della schermata generale.

Conseguenza: comorbidita_apr e allergie_testo usano **overwrite semplice** (non merge
accumulativo). Se il documento più recente ha dati per quel campo, quei dati sostituiscono
quelli del documento precedente. Se non ha dati (array vuoto), nulla viene scritto e i
valori precedenti sopravvivono.

## Comportamento residuo (by-design)
- `lab_exams` upsert: `{**existing, **new}` → nuovo vince su param condivisi per stessa data (backend clinical.py)
- `instrumental_exams`: nessun upsert → duplicati possibili se stesso esame in entrambi i PDF

**Why:** Il campo `patient` in `applyMulti` è la prop React — non si aggiorna tra le iterazioni del loop. La re-fetch esplicita è l'unico modo per avere stato fresco. Il sort cronologico garantisce che l'ordine di applicazione sia sempre deterministico e indipendente dall'ordine in cui l'utente ha caricato i PDF.

**How to apply:** Qualsiasi nuovo campo sulla schermata generale segue overwrite semplice in `_applyOneDraft`. Il sort in `applyMulti` garantisce la regola "latest wins" senza logica ad-hoc per campo.
