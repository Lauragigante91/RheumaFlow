---
name: PatientDetail strips architecture
description: Two new compact horizontal strips replaced ClinicalCockpit in PatientDetail follow-up mode.
---

## Rule
`PatientDetail.jsx` (follow-up mode, `!isWorkupMode`) now renders two strips instead of ClinicalCockpit:
1. `PatientProfileStrip` — 6-column patient background strip
2. `RheumatologicStatusStrip` — workup or monitoring strip

`ClinicalCockpit` is still used unchanged in `WorkupVisitPage.jsx`.

**Why:** The old single-panel text-block ClinicalCockpit was replaced with a visual compact horizontal design matching the clinical screenshot.

## How to apply
- Any change to patient profile display in follow-up → edit `PatientProfileStrip.jsx`
- Any change to workup/monitoring strip → edit `RheumatologicStatusStrip.jsx`
- ClinicalCockpit changes still affect WorkupVisitPage
- Do NOT add new editable fields to ClinicalCockpit for follow-up patients

## Data flow
- `PatientProfileStrip`: reads `firstVisit.data` fields directly + loads `clinical_cockpit` disease profile → calls `onCockpitData` with enriched data (incl. `comorbidities_text`, `therapy_dom_text`, `allergies_text`, `other_text`)
- `RheumatologicStatusStrip`: derives `referralText`, `hypotheses` from firstVisit + workupVisits; loads exam statuses from `clinical_cockpit.exam_statuses`; calls `onWorkupData` with `workup_motivo_text` + `workup_esami_text`
- `PatientDetail` merges both into `cockpitData = { ...cockpitData, ...workupReportData }` for `TodayVisitSection`

## Report integration (FollowUpReportModal COCKPIT_DEFS keys)
- Existing: `cockpit_physiologic`, `cockpit_family` (physiologic/family history)
- New profile: `profile_comorbidities`, `profile_therapy`, `profile_allergies`, `profile_other`
- New workup: `workup_motivo_ipotesi`, `workup_esami_richiesti`

## Exam statuses
- Stored in `clinical_cockpit.exam_statuses` as `{ [examKey]: "mancante" | "eseguito" | "programmato" }`
- Cycled by clicking the status badge in `RheumatologicStatusStrip`
- Keys are the same as `WORKUP_TESTS` keys from WorkupVisitPage (e.g. `cbc`, `ena`, `hrct`)
