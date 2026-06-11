---
name: SSc profile read-only derived fields
description: Architectural decision — SSc profile shows derived data from instrument/assessment sources as read-only; no double truth.
---

## Rule
The SSc profile (ScleroProfileSection) is a **read-only dashboard** for data that lives in authoritative source records. Never add editable inputs for these fields in the profile.

| Field | Source |
|---|---|
| mRSS score + date | `assessments` (index_type="mrss") |
| Capillaroscopia pattern + data | `instrumental_exams` (exam_type="capillaroscopy") |
| HRCT pattern + data | `instrumental_exams` (exam_type="hrct") |
| FVC % / DLCO % / data PFR | `instrumental_exams` (exam_type="pft", structured_values) |
| PSAP eco | `instrumental_exams` (exam_type="echo_cardiac", structured_values.echo_psap) |

## Implementation
- State: `derived = { mrss, capillaroscopy, hrct, pft, echo }` (replaces old `archiveInstrumental`)
- `DerivedField` component shows value/text + date in teal pill with "sola lettura" badge
- Sections array passes `derived` to renderCutaneous, renderVascular, renderILD, renderPAH
- Data loaded by two useEffects: instrumentalExamsApi.list + assessmentsApi.list

**Why:** Avoid double truth. If the user corrects a capillaroscopy finding, they correct the source exam, not the profile. The profile reflects the current state of the sources automatically.

**How to apply:** If adding new derived fields to the SSc profile, follow the same pattern: load from source in useEffect → setDerived → use DerivedField in render function. Do NOT add editable inputs.
