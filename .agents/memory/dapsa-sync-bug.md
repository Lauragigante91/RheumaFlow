---
name: DAPSA sync PatientDetail → TodayVisitSection
description: Bug dove DAPSA nel referto mostrava 2/Remissione invece del valore corretto calcolato dal Form unificato AP (CompositeAssessmentDialog mode=psa).
---

**Regola:** SPA_TYPES in PatientDetail.jsx deve includere "dapsa" oltre a "asdas_crp"/"asdas_esr"/"basdai".

**Why:** CompositeAssessmentDialog (mode="psa") salva assessment con index_type="dapsa". Il sync PatientDetail→TodayVisitSection filtrava solo SPA_TYPES — senza "dapsa", spaPga/spaPeriph/spaPcr restavano vuoti → dapsa useMemo = tjc+sjc+0+0+0 → valore parziale nel referto.

**How to apply:** Ogni volta che si aggiunge un nuovo index_type SpA/PsA in CompositeAssessmentDialog, verificare che SPA_TYPES in PatientDetail.jsx lo includa.

**Differenze nei nomi dei campi DAPSA vs ASDAS/BASDAI:**
- DAPSA inputs: `patientPain` (non `peripheralPain`); `crp` in mg/dL (non mg/L); `tjc68`/`sjc66`
- Il sync usa `peripheralPain` per setSpaPeriph → per DAPSA: `isDapsa ? spaInp.patientPain : spaInp.peripheralPain`
- Il CRP DAPSA (mg/dL) va moltiplicato ×10 per ottenere spaPcr in mg/L: `Number(spaInp.crp) * 10`
