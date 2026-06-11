---
name: Allergie canonical field
description: allergie_testo is the DB canonical. Two parallel allergie stores exist. fmtComorbForReport must merge both with dedup.
---

# Allergie field architecture

## Two parallel stores

| Store | Type | Written by | Read by |
|-------|------|-----------|---------|
| `patient.allergie_testo` | free text | PDF import (_applyOneDraft) + FirstVisitPage save | PatientProfileStrip (via field map `drug_allergies: "allergie_testo"`) |
| `patient.comorbidities.allergologic[]` | string array | FirstVisitPage checkbox picker | PatientProfileStrip + fmtComorbForReport |

## Canonical DB field
`allergie_testo` (Optional[str]) — backend/models.py lines 66 and 97.

## Parser → DB path
`profilo_generale.allergie` (parser output, no suffix) → `_applyOneDraft` line 328 → `patch.allergie_testo` → `patientsApi.patch()`. **Correctly mapped.**

## Report generation
`fmtComorbForReport(data, firstVisitData)` — WorkupVisitPage.jsx.
Takes `firstVisitData.drug_allergies` (= `allergie_testo`) as 2nd param.
Merges with `comorbidities.allergologic[]` using **case-insensitive dedup**.
All 3 call sites pass `fvData` as 2nd arg.

**Why the 2nd param was added:** fmtComorbForReport previously only read structured allergologic[] — PDF-imported allergie_testo was visible in PatientProfileStrip but silently absent from the generated report.
