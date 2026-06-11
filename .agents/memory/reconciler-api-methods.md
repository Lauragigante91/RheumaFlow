---
name: Reconciler API method names bug
description: The parseMulti reconciler in VisitImportButton.jsx fetches existing patient data via Promise.allSettled. Only listByPatient exists on these API clients — not list.
---

## The bug

`VisitImportButton.jsx` (parseMulti function) fetches existing data for reconciliation:

```js
await Promise.allSettled([
  therapiesApi.listByPatient(patient.id),    // CORRECT
  assessmentsApi.listByPatient(patient.id),  // CORRECT
  labExamsApi.listByPatient(patient.id),     // CORRECT
])
```

Previously these called `.list(patient.id)` which threw `TypeError: ... is not a function`. `Promise.allSettled` catches it silently → all three return `status: "rejected"` → `existingData` starts empty → reconciler marks ALL therapies/assessments/labs as NEW.

## Impact

- No continuity detection: drugs already active in DB weren't recognized as continuing
- No dedup for assessments or lab exams
- Did NOT prevent saves (upsert still ran) but corrupted reconciler state

## Rule

`therapiesApi`, `assessmentsApi`, `labExamsApi` in `frontend/src/lib/api.js` all use `listByPatient(patientId)` not `list(patientId)`. Only `instrumentalExamsApi` uses `list(patientId)`.

**Why:** Different API client conventions were mixed during development. Always verify against api.js before using.
