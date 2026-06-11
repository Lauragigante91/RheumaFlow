---
name: Follow-up visit architecture
description: How TodayVisitSection separates visit narrative from assessment scores using workup_visit documents.
---

## Rule
Every follow-up save creates (or patches) a `workup_visit` with `visit_type:"follow_up"` BEFORE creating assessments. The `workup_visit.id` is then stamped on every assessment as `visit_id` + `visit_type:"follow_up"`.

## What lives where
- **workup_visit (visit_type:"follow_up")**: `rheumatologic_history_summary`, `interval_history`, `physical_exam` (string), `physical_exam_joint_exam/systems/mrss/pasi/lei` (dicts), `labs_imaging`, `conclusions`, `status:"completed"`
- **assessment**: `visit_id`, `visit_type:"follow_up"`, score inputs — NO narrative blob in `notes` (null for RA/SpA/PMR; brief clinical note only for clinical_note)

## Sidebar rendering
- `sidebarUnifiedVisits` type `"workup"` covers both workup AND follow_up visits (both come from `workupVisits` state)
- `WorkupVisitCard` shows "Follow-up" badge (indigo) when `visit.visit_type === "follow_up"`, "Workup" (amber) otherwise
- Legacy assessment-only groups remain as type `"followup"` → `PreviousVisitPreviewModal` with notesMap fallback

## Auto-import useEffects
- `intervalHistory`, `labsImaging`, `note` (conclusions): check `workupVisits` with `visit_type === "follow_up"` first, then fall back to regex on `assessment.notes` blob
- `physicalExam`: handles both string form (new follow_up visits, `typeof v.physical_exam === "string"`) and object form (`v.physical_exam?.free_text`, legacy workup)

## Export
- `workup_visit(visit_type:"follow_up")` → header "FOLLOW-UP — date" (no number counter)
- `workup_visit(visit_type:"workup")` → header "WORKUP DIAGNOSTICO #N — date" (sequential counter)
- Legacy assessment export filters `a.visit_id` truthy to avoid duplicates

## API
- `PATCH /workup-visits/{visit_id}`: partial update, protected fields excluded (`id, patient_id, organization_id, created_by, created_at`)
- `workupVisitsApi.patch(visitId, data)` in api.js

**Why:** Assessment `notes` blob was the only way to store narrative; migrating to structured `workup_visit` fields enables proper visit timeline, diff, and export without parsing raw text.
