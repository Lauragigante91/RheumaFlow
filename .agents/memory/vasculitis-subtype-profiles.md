---
name: Vasculitis subtype disease profiles
description: Architecture decisions for CryoVas, UrticarialVas, Behçet profiles added alongside IgAV.
---

## Files changed
- `frontend/src/components/profiles/CryoVasProfileSection.jsx` — key: `cryo_vas`
- `frontend/src/components/profiles/UrticarialVasProfileSection.jsx` — key: `urticarial_vas`
- `frontend/src/components/profiles/BehcetProfileSection.jsx` — key: `behcet`
- `frontend/src/lib/diseaseDetection.js` — added 3 detection functions
- `frontend/src/lib/diseaseWidgets.js` — 3 new workflows + 5 new symptom chips
- `frontend/src/pages/PatientDetail.jsx` — imports + rendering + hasProfiles

## Detector cascade order (critical)
All non-AAV vasculitis subtypes MUST be checked BEFORE `isAavDiagnosis` because it matches "vasculit*".
Current order in `detectDiseaseWorkflow`:
1. igav → 2. cryo_vas → 3. urticarial_vas → 4. behcet → 5. (isAavDiagnosis)

`isAavDiagnosis` now explicitly excludes all four via early returns (isIgaVDiagnosis, isCryoVasDiagnosis, isUrticarialVasDiagnosis).
Behçet doesn't match "vasculit" but is excluded from AAV cascade order anyway for correctness.

**Why:** `isAavDiagnosis` is a broad catch-all for ANCA-associated disease and would misclassify patients as AAV without the ordering guard and early returns.

## Detection terms per disease
- **CryoVas**: "crioglobulin", "cryoglobulin", "criovas"
- **UrticarialVas**: "orticarioide", "urticarial vas", "mcduffie", regex `/(^|\s|\|)huv(\s|,|\.|\||$)/`, "hypocomplementemic urticarial"
- **Behçet**: "behçet", "behcet", "adamantiades"

## Behçet ICBD 2014 score
Computed live in `BehcetProfileSection` via `useMemo` over `data.icbd` object.
Items and points: oral_ulcers(2), genital_ulcers(2), ocular(2), skin_lesions(1), neuro(1), vascular(1), pathergy(1).
Score ≥4 → green badge "Criteri soddisfatti". Score shown always as "N / 10".

## New symptom chips added to SYMPTOM_LIBRARY
- `livedo` — Livedo reticularis (CryoVas)
- `neuropathy` — Neuropatia periferica (CryoVas)
- `urticaria` — Orticaria vasculitica (UV/HUV)
- `oral_ulcers_bd` — Ulcere orali ricorrenti (Behçet, separate from any other oral_ulcers key)
- `genital_ulcers` — Ulcere genitali (Behçet)
