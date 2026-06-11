---
name: Disease profile import from letter
description: How the "Importa da lettera" feature extracts and saves disease-specific profiles (RA, SpA, SLE, SSc).
---

## The rule

Each disease profile is extracted only if the letter text contains the disease name keyword:
- RA: requires "artrite reumatoide" or `\bAR\b`
- SpA: requires "spondiloartr", "spondilite anchilos", `\bSpA\b`, "artrite psoriasica", `\bPsA\b`
- SLE: requires `\bLES\b`, `\bSLE\b`, or "lupus eritematoso"
- SSc: requires "sclerosi sistemica", "SSc", "sclerodermia" (handled by older extractScleroProfile)

If the guard fails (wrong disease), extractor returns `null` and that section never appears in the review or apply.

## Merge strategy

`apply()` always reads existing data first (`diseaseProfileApi.get(...).catch(() => null)`), then merges:
- For scalar fields: only overwrites if new value is non-null/non-empty
- For `antibodies` dict (SLE): merges at key level, not replaces wholesale
- This means import never deletes data the user entered manually

## API calls

- `diseaseProfileApi.upsert(patientId, "ra"|"spa"|"sle", mergedData)` → PUT /patients/{id}/disease-profile/{type}
- Body shape: `{ patient_id, data: mergedData }`
- SSc uses separate endpoint: `scleroProfileApi.upsert(patientId, mergedData)`

**Why:** The user complained "non compila il profilo di malattia" — the import was extracting scores, therapies, and labs but never touching the disease-specific profile sections (RaProfileSection, SpaProfileSection, SleProfileSection).

**How to apply:** When adding a new disease profile type (e.g., Sjögren "sjogren", AAV "aav"), follow the same pattern: add `extractXProfile(text)` in visitTextParser.js with a disease keyword guard, add it to the parseVisitText return, add to selected state, add apply block, add sections + SectionPreview in VisitImportButton.
