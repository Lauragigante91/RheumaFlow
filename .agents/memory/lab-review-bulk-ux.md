---
name: Lab review (Da revisionare) — two consumers + batched bulk ops
description: How the lab_review_items import UI is wired, why bulk operations must batch, and the trusted-units whitelist that classifies routine vs ambiguous params.
---

`lab_review_items` (HIGH_RISK_KEYS params with missing unit) are surfaced by
`LabValueReviewPanel`, which is rendered in TWO places with DIVERGENT exam-group
matching — both must be kept in sync on any change:
- single-visit wizard (`renderPreview` case `lab_review_items`): matches/creates the
  target `lab_exams` group by **date only**.
- multi-visit wizard: matches/creates by **panel + date** and stamps `panel`/`category`
  on new groups.

**Batching rule:** every lab-review handler closes over a single `extracted`/`d`
snapshot. Any multi-item operation (bulk accept group / accept all) MUST build the
complete new `lab_review_items` + `lab_exams` arrays in one pass and call
`onUpdate`/`onUpdateDraft` exactly ONCE. Looping the single-item callback loses all
but the last write (stale closure). Pre-clone each exam group's `results` array up
front so pushes never mutate the original draft; find-or-create inside the loop
coalesces same-target items.
**Why:** real reports flag dozens of routine values → alert fatigue; grouping +
one-click bulk accept fixes UX without removing the safety net (nothing auto-imports;
an explicit click is still required).

**Trusted-units whitelist** (`LAB_REVIEW_TRUSTED_UNITS` in labValueExtractor.js) is the
config SSOT for "routine" params (crp/ves/hb/wbc/plt/creatinine/ast/alt/egfr → default
unit). A review item whose key is in the map = routine (collapsed group, "unità assunta"
badge, safe bulk accept). A key NOT in the map (e.g. **proteinuria**, unit genuinely
varies g/24h vs mg/dL vs stick) = "verifica attenta" (expanded, shown first) → keeps
manual review for the genuinely ambiguous cases. Add/remove a routine param here.
