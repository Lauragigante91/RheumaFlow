import { toCanonicalLabKey } from "./labValueExtractor";

export function buildWorkupVisitPayload(extracted, patientId, visitType, selectedExamImaging) {
  const vs              = extracted.visit_sections || {};
  const wantExamImaging = selectedExamImaging &&
    Array.isArray(extracted.exam_imaging) &&
    extracted.exam_imaging.filter(x => !x._skip).length > 0;

  let labs_imaging_v = null;
  if (wantExamImaging) {
    labs_imaging_v = (extracted.exam_imaging || [])
      .filter(x => !x._skip)
      .map((f) => {
        const parts = [f.examLabel];
        if (f.territory)  parts.push(`(${f.territory})`);
        if (f.date)       parts.push(`[${f.date}]`);
        if (f.reportText) parts.push(`: ${f.reportText}`);
        return parts.join(" ");
      })
      .join("\n");
  }
  if (vs.labs_text) {
    labs_imaging_v = [labs_imaging_v, vs.labs_text].filter(Boolean).join("\n\n");
  }

  const wantReqTests = Array.isArray(extracted.requested_tests) &&
    extracted.requested_tests.length > 0;

  return {
    patient_id:                    patientId,
    visit_date:                    extracted.visit_date || new Date().toISOString().slice(0, 10),
    visit_type:                    visitType,
    rheumatologic_history_summary: vs.raccordo    || null,
    interval_history:              vs.anamnesi    || null,
    physical_exam:                 vs.esame_obj   || null,
    conclusions:                   vs.conclusioni || null,
    referral_note:                 vs.indicazioni || null,
    labs_imaging:                  labs_imaging_v,
    requested_tests:               wantReqTests ? extracted.requested_tests : null,
    home_therapies_text:           extracted.profilo_generale?.terapia_domiciliare || null,
    status:                        "completed",
  };
}

export function buildTherapyUpsertPayload(t, patientId, importedVisitId) {
  return {
    patient_id:             patientId,
    drug_name:              t.drug_name,
    category:               t.category || "other",
    dose:                   t.dose || null,
    frequency:              t.frequency || null,
    route:                  t.route || null,
    start_date:             t.start_date || null,
    status:                 t.status || "active",
    discontinuation_reason: t.discontinuation_reason || null,
    notes:                  t.notes || null,
    visit_id:               importedVisitId || null,
  };
}

export function buildTherapyContinuityPayload(t, patientId, importedVisitId, today) {
  return {
    patient_id: patientId,
    drug_name:  t.drug_name,
    category:   t.category || "other",
    dose:       t.dose || null,
    frequency:  t.frequency || null,
    route:      t.route || null,
    start_date: t.start_date || today,
    status:     "active",
    visit_id:   importedVisitId || null,
  };
}

export function buildAssessmentPayload(a, patientId, visitDate, importedVisitId, visitType, sourceFilename) {
  return {
    patient_id:      patientId,
    index_type:      a.index_type,
    date:            a.date || visitDate,
    score:           a.score ?? null,
    interpretation:  a.interpretation || null,
    inputs:          a.inputs || {},
    tender_joints:   Array.isArray(a.tender_joints) ? a.tender_joints : [],
    swollen_joints:  Array.isArray(a.swollen_joints) ? a.swollen_joints : [],
    notes:           a.notes || null,
    visit_category:  a.visit_category || "score",
    source_filename: sourceFilename || null,
    ...(importedVisitId ? { visit_id: importedVisitId, visit_type: visitType } : {}),
  };
}

export function buildLabExamPayload(ex, patientId, sourceFilename) {
  const results = (ex.results || []).filter(r => !r._skip);
  const values  = {};
  for (const r of results) {
    const key = r.param_key || toCanonicalLabKey(r.name);
    const v   = {};
    if (r.value != null && r.value !== "") v.value = r.value;
    if (r.unit)        v.unit       = r.unit;
    if (r.qualitative) v.qualitative = r.qualitative;
    if (r.status && r.status !== "normal") v.status = r.status;
    if (Object.keys(v).length > 0) values[key] = v;
  }
  return {
    patient_id:      patientId,
    date:            ex.date ?? null,
    values,
    notes:           null,
    source_filename: sourceFilename || null,
  };
}

export function buildInstrumentalExamPayload(f, patientId, visitDate, examType) {
  return {
    patient_id:        patientId,
    exam_date:         f.date || visitDate,
    exam_type:         examType || f.indexType || f.examType || "other",
    territory:         f.territory || null,
    result:            f.result || null,
    summary:           f.summary || "",
    source_text:       f.sourceText || null,
    structured_values: f.structured_values || null,
  };
}
