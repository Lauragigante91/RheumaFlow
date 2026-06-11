---
name: Therapy episode model
description: Architectural decisions for the longitudinal therapy model — episodes, events, relevance, upsert pipeline.
---

## Core principle
Each document in `db.therapies` = one therapy episode (one continuous treatment period for one drug).
A drug can have multiple episodes over time (e.g., MTX 1999–2008, MTX 2012–2020, MTX 2023–now).
Discontinuation always closes an episode. Restart after discontinuation always opens a new episode document.

## Rule: episode vs event
- continued, dose_increased, dose_reduced → event INSIDE the same episode (episode must be active)
- discontinued → event INSIDE episode + closes it (status=discontinued, end_date=event_date)
- paused → manual only (status=paused), never from import pipeline
- resumed_within → manual only (status back to active), never from import pipeline
- active incoming + existing discontinued/paused → NEW episode document

## New fields on Therapy (all optional, backward-compatible)
- `drug_canonical`: normalized lowercase drug name for grouping episodes of same drug
- `therapy_type`: rheum_dmard | glucocorticoid | nsaid | cardiovascular | metabolic | antiviral | osteoporosis | supportive | other
- `relevance`: high | medium | low (for UI display priority; not for storage logic)
- `events: List[TherapyEvent]`: embedded array of clinical events

## TherapyEvent fields
type, date, dose, dose_before, dose_after, reason, visit_id, created_by, created_by_name, created_at, notes

## API endpoints (clinical.py)
- POST /api/therapies — legacy create (backfills drug_canonical, therapy_type, relevance)
- POST /api/therapies/upsert — episode-aware upsert (smart: continued/dose_change/discontinue/new_episode)
- POST /api/therapies/{id}/events — manual add event with side-effects on status/dose

## Import pipeline (Fase B)
- visitTextParser.js: populates `discontinuation_reason` field (not just `notes`)
- visitReconciler.js: two bugs fixed:
  1. existing=active + t=discontinued → UPDATE _action:"discontinue" (was silently CONTINUITY+skip)
  2. existing=active + dose differs (mg numeric) → CONFLICT _action:"dose_change" (was silently CONTINUITY+skip)
  - New fields on items: _action, _existing_id, _dose_before, _call_upsert
- _applyOneDraft in VisitImportButton.jsx: calls therapiesApi.upsert() (not create())
  - Non-skip items: full upsert (new episode, suspension, dose change, resumption)
  - CONTINUITY items with _call_upsert=true: background upsert for "continued" event (high-relevance only, not counted in updates)

## Continued event policy (relevance-based)
- relevance=high (DMARDs, biologics, GC): "continued" event recorded at each import visit
- relevance=low/medium (cardiovascular, metabolic, etc.): NO continued event; only dose_change, discontinued, started recorded
- Policy enforced in backend upsert_therapy, derived from existing.relevance or category fallback

## UI principle (not yet implemented)
- Same db.therapies for all therapies; relevance/therapy_type determines display placement
- relevance=high → "Terapia Reumatologica" section
- relevance=low → badge/chip in "Profilo Generale" section
- UI groups episodes by drug_canonical for longitudinal view

## Normalization helpers
- _norm_drug_canonical(name): lowercase, collapsed spaces
- _extract_dose_mg(dose_str): extracts float mg value; returns None if not readable (avoids false positives)
- normDoseMg(dose) in reconciler: same logic in JS

## Legacy document handling
- _find_active_episode: primary query on drug_canonical; fallback query on drug_name regex for docs without drug_canonical
- First upsert call on legacy doc backfills drug_canonical, therapy_type, relevance automatically
