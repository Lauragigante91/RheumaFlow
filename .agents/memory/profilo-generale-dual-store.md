---
name: Profilo generale — patient doc as SSOT (Phase 2C)
description: Patient document is canonical source for narrative profile fields; PatientProfileStrip reads directly from patient prop with prima_visita.data as legacy fallback.
---

## The Rule

**Patient document** = SSOT for all general patient narrative fields:
- `anamnesi_fisiologica`, `anamnesi_familiare`, `comorbidita_apr`, `terapia_domiciliare`, `allergie_testo`

**prima_visita disease profile** = SSOT only for structural/disease-specific fields:
- `comorbidities` (chip lists), `comorbidity_details`, `therapy_prescription`, etc.
- `physiologic_history` / `family_history` in prima_visita.data = legacy fallback only (read-only)

## Architecture

`PatientProfileStrip` receives `patient` prop (full patient document) + `firstVisit` prop (prima_visita disease profile). It computes:
```js
const patientNarrative = {
  physiologic_history:    patient?.anamnesi_fisiologica || fvBase.physiologic_history || null,
  ...
};
const fvMerged = { ...fvBase, ...patientNarrative_non_null };
const fvData = localFv ?? fvMerged;
```
Patient doc takes priority; prima_visita.data fields are legacy fallback for old patients.

`saveFields()` in PatientProfileStrip already correctly routes:
- Narrative fields → `patientsApi.update` (via PATIENT_NARRATIVE_MAP)
- Structural fields → `diseaseProfileApi.upsert("prima_visita")`

`_applyOneDraft` in VisitImportButton saves profilo_generale to patient doc only — no duplicate write to prima_visita.

**Why:** Phase 2C migration moved narrative fields from prima_visita.data to the patient document. Before the fix, the display still read from prima_visita.data (old location), so imports to patient doc were invisible.

**How to apply:** Always pass `patient={patient}` to PatientProfileStrip. Do NOT write `physiologic_history` etc. back to prima_visita from the import flow — single source of truth.
