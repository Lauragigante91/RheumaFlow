---
name: Scalaggio steroide — due path di generazione (stepRules vs dosi standard)
description: Perché generateTaperingPlan ha due algoritmi, quando si usa ciascuno, gating e vincoli.
---

# Scalaggio steroide — due path di generazione

`generateTaperingPlan(config)` in `frontend/src/lib/steroidTapering.js` ha due algoritmi distinti, scelti dal flag `config.standardDoseSequence`:
- **stepRules walk** (flag assente/false): usato dai preset clinici (PMR/GCA/...). Riduce di `reductionMg` ogni `intervalDays` finché raggiunge il target.
- **sequenza a dosi standard** (flag true): usato dal flusso MANUALE byDate. Costruisce la discesa tra le dosi standard {25,20,18.75,15,12.5,10,7.5,5,2.5} strettamente tra dose corrente e target (più il target finale) e le distribuisce uniformemente nei giorni disponibili (`interval = floor(availableDays / numLevels)`).

**Why:** i preset come GCA partono da 50 mg, oltre il massimo della lista standard (25). Un path a sole dosi standard farebbe 50→25 (salto clinicamente eccessivo): quindi i preset DEVONO restare sullo stepRules walk; la sequenza standard serve solo per tapering manuali (tipicamente ≤25 mg). Il vecchio path manuale ripeteva la dose iniziale, usava dosi non standard e non raggiungeva mai il target perché reduction/interval fissi ignoravano i giorni disponibili.

**How to apply:**
- Il modale imposta `standardDoseSequence: !appliedPreset` → manuale usa il nuovo path, preset il vecchio. Non rimuovere il gating: romperebbe i preset (test PMR/GCA con sequenza esatta).
- Se non bastano i giorni (`availableDays < numLevels`) → warning e nessuno schema per quel target; se `interval < MIN_SAFE_INTERVAL_DAYS` (7) → warning + clamp a 7 (lo schema può superare la data richiesta).
- Gli assert esatti sulle date dipendono da TZ Europe/Rome forzato in `craco.config.js` (solo test env).
