---
name: Import review screen architecture
description: VisitImportButton UI flow (input→review) and warn-free batch logic
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
