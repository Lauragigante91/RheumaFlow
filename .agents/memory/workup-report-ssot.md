---
name: WorkupVisitPage report SSOT architecture
description: How WorkupReportModal sources its data; dead code warnings; fvData pattern.
---

## Report data flow (WorkupReportModal)

The printed report gets ALL narrative profile data from **`cockpitData`** (set by PatientProfileStrip + RheumatologicStatusStrip via `onCockpitData` / `onWorkupData` callbacks):

- `cockpitData.comorbidities_text` → profile_comorbidities section
- `cockpitData.therapy_dom_text` → profile_therapy section (reads `patient.terapia_domiciliare` via PATIENT_NARRATIVE_MAP)
- `cockpitData.allergies_text` → profile_allergies section (merges allergologic[] + allergie_testo)
- `cockpitData.workup_motivo_text` / `workup_esami_text` → from RheumatologicStatusStrip

This path is CORRECT — it reads from patient doc (SSOT) via PatientProfileStrip.

## Dead code in WorkupVisitPage

- `fmtTherapiesForReport()` is defined but **never called** anywhere.
- `comorbText` prop passed to WorkupReportModal: the handler `if (key === "comorbidities")` exists but "comorbidities" is NOT in the SECTIONS constant → prop is never used in the printed report.
- Both exist for historical reasons; do not delete without checking if a future section key "comorbidities" is intentionally added.

## fvData pattern

`fvData` in WorkupVisitPage provides `{ drug_allergies, current_therapies_text }` for the **inline form preview** at lines 964-986 (comorbidità read-only block), NOT for the report. It must be a `useMemo` declared BEFORE the `if (loading)` early return (rules-of-hooks):

```js
const fvData = useMemo(() => patient ? {
  drug_allergies:         patient.allergie_testo      || null,
  current_therapies_text: patient.terapia_domiciliare || null,
} : null, [patient]);
```

## WorkupVisitBase model fields

`home_therapies_text` and `comorbidities_text` are `Optional[str]` in `WorkupVisitBase` (visits.py). Without these declarations Pydantic silently strips them on create/update.

**Why:** import flow writes `home_therapies_text` (therapy snapshot at visit time); save() preserves it across edits. These are visit-level snapshots, distinct from `patient.terapia_domiciliare` (current canonical).
