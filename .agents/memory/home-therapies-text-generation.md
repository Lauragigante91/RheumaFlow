---
name: home-therapies-text-generation
description: Passo 2 — home_therapies_text auto-generation from therapy_state_at at visit save time.
---

# home_therapies_text Auto-Generation (Passo 2)

## Rule
`home_therapies_text` on a workup_visit is a **historical snapshot** of the therapy
state at `visit_date`, generated automatically at visit creation from the therapy
event ledger — NOT from `patient.terapia_domiciliare`.

## Implementation

### helpers.py (single source of truth)
- `_episode_state_at(episode, target_date)` — pure point-in-time reconstruction
- `_therapy_state_at(episodes, target_date)` — filter list to active episodes
- `_format_therapy_snapshot(states)` — multi-line text (drug_name dose route frequency)
- `generate_home_therapies_text(patient_id, org_id, visit_date, fallback_text)` — async, queries db.therapies

### visits.py
- `create_workup_visit` (POST): always calls `generate_home_therapies_text`; payload value is `fallback_text` only
- `update_workup_visit` (PUT): reads existing doc first; if `home_therapies_text` already set → preserve it; if null → call `generate_home_therapies_text`

### Duplication eliminated
- `clinical.py`: removed local `_episode_state_at` + `_therapy_state_at`; imports from helpers
- `export.py`: removed local `_episode_state_at`; imports from helpers

## Fallback behaviour
- `therapy_state_at` returns 0 therapies (e.g. pre-therapy visit in 2022) → uses payload/manual text
- Logged always with `fallback=yes|no`

**Why:** Historical accuracy — the report must show what the patient was taking *at that date*, not the current medication list.
