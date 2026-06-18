---
name: Import review screen architecture
description: VisitImportButton UI flow (input→review), warn-free batch logic, VisitFacsimile 14-section structure
---

## Rule
`VisitImportButton` uses a 2-step flow: `input` (textarea/multi-block) → `review` (full-screen `ImportReviewScreen`). There is no intermediate wizard step.

`ImportReviewScreen` receives `visitResults[]` (each item has `draft`, `stats`, `sourceText`). Left pane = raw source text; right pane = editable `VisitFacsimile`.

## Batch confirm — warning-free only
`hasWarning(item)` = `stats.conflicts > 0` OR `draft.lab_review_items.length > 0` OR `draft._parse_review.unresolved.length > 0`.

"Conferma tutte senza warning" calls `applyMulti()` which filters `toApply` to warning-free visits only. Visits with warnings are skipped and a toast explains how many remain. The button is disabled when `warnFreeCount === 0`.

Single-visit confirm (`applyOne`) is not filtered — the doctor explicitly reviews and confirms that one visit.

## Why
Batch import of visits with unresolved conflicts or review flags would silently overwrite existing data or import low-confidence lab values without doctor review. The batch path must be zero-risk.

## How to apply
- `hasWarning` is defined in both `ImportReviewScreen.jsx` (for button state) and `VisitImportButton.jsx` (for batch filter). Keep them in sync.
- Navigation prev/next follows `sortedOrder` (by date), same order as the sidebar.
- `applyOne` always works regardless of warnings (doctor reviewed it explicitly).

## VisitFacsimile — 14 sezioni fisse
`VisitFacsimile` mostra SEMPRE 14 sezioni nello stesso ordine, anche se vuote (TextSection con placeholder). Nessun guard condizionale nell'export.

Mapping sezioni → campi draft:
1. Diagnosi → `pg.diagnosi`
2. Anamnesi fisiologica → `pg.anamnesi_fisiologica`
3. Anamnesi familiare → `pg.anamnesi_familiare`
4. Comorbilità / APR → `comorbidita[]` (ComorbidityEditor) oppure `pg.comorbidita_apr`
5. Terapia domiciliare → `pg.terapia_domiciliare` (testo ingresso)
6. Allergie → `intolleranze[]` (IntolleranzeEditor) oppure `pg.allergie`
7. Raccordo anamnestico → `raccordo_events[]`
8. Anamnesi intervallare → `vs.anamnesi`
9. Esame obiettivo → `EsameObiettivoEditor` (textarea + Homunculus mode="28")
10. Clinimetria → `AssessmentsEditor` (index_type/score/interpretazione/data inline)
11. Esami / imaging → lab_exams + lab_review_items + instrumental_findings + exam_imaging
12. Conclusioni → `vs.conclusioni`
13. Terapia in uscita → `therapies[]` (TherapyEditor)
14. Indicazioni ulteriori → `vs.indicazioni`

Helper `updVS`/`updPG` per merge sicuro senza sovrascrivere l'intera chiave padre.

## EO + Homunculus
`EsameObiettivoEditor`: `physical_exam_joint_exam` nel draft = override manuale (null = ricalcola). `buildWorkupVisitPayload` usa l'override se presente, altrimenti `parseJointExam(vs.esame_obj)` — nessun cambio a importApply.js o importPayloadBuilders.js.
