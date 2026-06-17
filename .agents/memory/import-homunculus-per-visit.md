---
name: Import → homunculus per-visita (physical_exam_joint_exam)
description: How the structured articular exam parsed from EO free text populates a per-visit homunculus on import, and the parser rule that makes conjoined statuses work.
---

## Parser: carry-backward must loop over consecutive status-only segments
`parseJointExam` pass-2 splits a clause on status keywords, then a joint-bearing
sub-segment with no status of its own borrows status from the FOLLOWING status-only
sub-segments. It must scan forward across ALL consecutive status-only segments, not
just the single next one.
**Why:** "Ginocchio sn dolente e tumefatto." splits into joint-first ("ginocchio…")
then two status-only segments ("dolente e" / "tumefatto"). Borrowing only the
immediate next yields `{knee_l:"tender"}`; the loop yields `{knee_l:"both"}`.
**How to apply:** the forward loop breaks on negation, on a segment that itself has
joints, or on a non-status filler — this keeps false-positive bleed onto the wrong
joint controlled (corpus FP stayed 0).

## ExamObjSection is shared by single AND multi import review
The editable joint editor lives in `ExamObjSection` (TJC/SJC + DAS28 count-grid +
the per-visit `<Homunculus mode="66_68">`). It is rendered in the single-import
review AND in the multi-import per-visit wizard (`MultiVisitWizard` →
`WizardVisitStep`, "B. Esame obiettivo articolare"), both wired with `onUpdateDraft`.
**Why:** editing one component covers both flows — do NOT add a second homunculus
editor to the multi review; it is already there. (An architect review wrongly
concluded multi-review was a flat batch summary; it is a per-visit wizard.)

## physical_exam_joint_exam lifecycle
- Seeded in `buildEditableDraft` (the single funnel for both single + multi parse
  paths) from `visit_sections.esame_obj`: `found ? joints : {}`.
- `reconcileDrafts` preserves it (`out = { ...draft }`).
- `buildWorkupVisitPayload` trusts the draft field when present; else re-parses
  `vs.esame_obj` (defensive fallback); normalizes empty `{}` → `null`.
- EO text (`physical_exam`) is ALWAYS imported, never gated on joint extraction.
- Per-visit isolation: one `workup_visit` per draft; the wizard's
  `updateCurrentDraft` only mutates `visitResults[currentIdx].draft`.
