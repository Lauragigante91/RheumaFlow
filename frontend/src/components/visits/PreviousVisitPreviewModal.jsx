import React from "react";
import { INDEX_LABELS } from "../../lib/clinimetrics";
import { serializePhysicalExam } from "../clinical/PhysicalExamSection";
import VisitDetailModal from "./VisitDetailModal";

// Re-export the canonical modal under the old name so existing imports don't break
export { default as VisitPreviewModal } from "./VisitDetailModal";

// Parse [Label]\ntext blocks from the legacy `notes` field (fallback for old visits)
function parseNotesMap(raw) {
  if (!raw?.trim()) return {};
  const result = {};
  const parts = raw.split(/\n\n(?=\[)/);
  for (const part of parts) {
    const m = part.match(/^\[([^\]]+)\]\n([\s\S]*)/);
    if (m) result[m[1].toLowerCase().trim()] = m[2].trim();
  }
  return result;
}

// Pull the first non-empty value of a field across all assessments
function firstField(assessments, field) {
  for (const a of assessments) {
    const v = a[field];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length) return v;
  }
  return null;
}

// ── Follow-up assessment modal (builds sections from group data) ──────────────
export default function PreviousVisitPreviewModal({ group, patient, onClose, onInsertToSection, insertSections }) {
  const { date, assessments = [], therapies = [], exams = [] } = group;

  // ── Build data from structured fields (primary) + notes fallback ─────────
  const notesRaw = assessments.find(a => a.notes?.trim())?.notes || "";
  const notesMap  = parseNotesMap(notesRaw);

  const raccordo        = firstField(assessments, "rheumatologic_history_summary") || notesMap["raccordo"] || null;
  const intervalHistory = firstField(assessments, "interval_history")              || notesMap["anamnesi intervallare"] || null;
  const labsImaging     = firstField(assessments, "labs_imaging")                  || notesMap["esami / imaging"] || null;
  const conclusions     = firstField(assessments, "conclusions")                   || null;

  // Physical exam — prefer structured serialization, fall back to free text / notes
  const physicalExamText = (() => {
    const a = assessments.find(a =>
      a.physical_exam?.trim() ||
      Object.keys(a.physical_exam_joint_exam || {}).length ||
      Object.keys(a.physical_exam_systems    || {}).length
    );
    if (a) {
      const serialized = serializePhysicalExam({
        free_text:  a.physical_exam             || "",
        joint_exam: a.physical_exam_joint_exam  || {},
        systems:    a.physical_exam_systems     || {},
        mrss:       a.physical_exam_mrss        || {},
        pasi:       a.physical_exam_pasi        || {},
        lei:        a.physical_exam_lei         || {},
      });
      return serialized?.trim() || a.physical_exam?.trim() || null;
    }
    return notesMap["esame obiettivo"] || null;
  })();

  // Requested tests
  const reqTestsText = (() => {
    for (const a of assessments) {
      const tests = Array.isArray(a.requested_tests) ? a.requested_tests.filter(Boolean) : [];
      const notes = a.requested_tests_notes?.trim() || "";
      if (tests.length || notes) return [tests.join(" · "), notes].filter(Boolean).join("\n");
    }
    return null;
  })();

  // Clinimetria — one line per scored assessment
  const clinimetriaLines = assessments
    .filter(a => a.score != null)
    .map(a => {
      const label = INDEX_LABELS[a.index_type] || a.index_type;
      return `${label}: ${a.score}${a.interpretation ? `  →  ${a.interpretation}` : ""}`;
    });
  const clinimetriaText = clinimetriaLines.length ? clinimetriaLines.join("\n") : null;

  // Active therapies
  const therapyText = therapies.length
    ? therapies
        .map(t => [t.drug_name, t.dose, t.frequency, t.route].filter(Boolean).join(" · "))
        .join("\n")
    : null;

  const SECTIONS = [
    raccordo        && { color: "amber", number: null, label: "RACCORDO ANAMNESTICO REUMATOLOGICO", text: raccordo },
    intervalHistory && { color: "amber", number: "1",  label: "ANAMNESI INTERVALLARE",              text: intervalHistory },
    physicalExamText && { color: "amber", number: "2", label: "ESAME OBIETTIVO",                    text: physicalExamText },
    labsImaging     && { color: "amber", number: "3",  label: "ESAMI / IMAGING",                    text: labsImaging },
    clinimetriaText && { color: "amber", number: "4",  label: "CLINIMETRIA",                        text: clinimetriaText },
    conclusions     && { color: "amber", number: "5",  label: "CONCLUSIONI / ASSESSMENT",           text: conclusions },
    reqTestsText    && { color: "blue",  number: "6",  label: "ESAMI RICHIESTI",                    text: reqTestsText },
    therapyText     && { color: "blue",  number: "10", label: "TERAPIA",                            text: therapyText },
  ].filter(Boolean);

  return (
    <VisitDetailModal
      onClose={onClose}
      dateIso={date}
      patient={patient}
      sections={SECTIONS}
      onInsertToSection={onInsertToSection}
      insertSections={insertSections}
    />
  );
}
