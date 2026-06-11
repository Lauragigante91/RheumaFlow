---
name: IgAV disease profile
description: Architecture and key decisions for the IgA Vasculitis (HSP) disease profile added to RheumaFlow.
---

## Files changed
- `frontend/src/components/profiles/IgaVProfileSection.jsx` — new profile component
- `frontend/src/lib/diseaseDetection.js` — added `isIgaVDiagnosis()`
- `frontend/src/lib/diseaseWidgets.js` — added `igav` workflow + symptoms (purpura, abdominal_pain, hematuria)
- `frontend/src/pages/PatientDetail.jsx` — import + rendering in profile tab

## Detection order (critical)
`isIgaVDiagnosis` is checked BEFORE `isAavDiagnosis` in `detectDiseaseWorkflow`.
**Why:** `isAavDiagnosis` matches "vasculit*" which would catch IgAV too. IgAV is a distinct entity (not ANCA-associated) and needs its own profile section, not the AAV section. `isAavDiagnosis` now explicitly excludes IgAV via `if (isIgaVDiagnosis(d)) return false`.

## Detection terms for IgAV
"schönlein", "schonlein", "henoch", "porpora di", "igav", "iga vasculit", "vasculite iga", "vasculite ad iga", "porpora anafilattoide", "hsp"

## Profile API key
`diseaseProfileApi.upsert(patientId, "igav", data)` — stored in `disease_profiles` collection with `disease_type: "igav"`.

## Profile sections
1. Forma clinica (HSP classica / IgAV nefritica / adulto / atipica)
2. Fattore scatenante (infezione VADS, streptococco, COVID, farmaco, vaccino, idiopatico)
3. Sierologico (IgA livello + elevata flag, complemento C3/C4, ANCA, ANA)
4. Organi coinvolti (cute, rene, GI, articolare, scrotale, neurologico)
   - Cute: distribuzione porpora + biopsia cutanea con IFD (IgA +/-)
   - Rene: proteinuria range, eGFR baseline, biopsia renale + Oxford MEST-C
   - GI: dolore addominale, sanguinamento, invaginazione, vomito
   - Articolare: tipo (artralgie/artrite) + sedi
5. Base diagnostica (biopsia cute IFD, biopsia renale, criteri ACR/EULAR 2010, eco addome)
6. Decorso (monoperiodico / recidivante / cronico + n° recidive)
7. Note cliniche (testo libero)

## Workflow
- `primaryIndexTypes: ["bvas"]` — BVAS è l'indice più usato anche in IgAV adulto grave
- `reportTemplate: "vasculitis"` — riusa il template vasculiti (nessun template IgAV-specifico)
- Symptom chips: purpura, renal_symptoms, hematuria, abdominal_pain, pain, fever, rash, fatigue, adverse_events
