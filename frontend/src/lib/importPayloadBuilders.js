import { toCanonicalLabKey } from "./labValueExtractor";
import { parseJointExam } from "./jointExamParser";

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

  let jointExam   = extracted.physical_exam_joint_exam;
  let sacroiliacE = extracted.physical_exam_sacroiliac;

  if (jointExam === undefined || jointExam === null) {
    const parsedJoints = parseJointExam(vs.esame_obj || "");
    jointExam   = parsedJoints.found ? parsedJoints.joints    : null;
    if (sacroiliacE === undefined || sacroiliacE === null) {
      sacroiliacE = Object.keys(parsedJoints.sacroiliac || {}).length ? parsedJoints.sacroiliac : null;
    }
  }
  if (jointExam   && Object.keys(jointExam).length   === 0) jointExam   = null;
  if (sacroiliacE && Object.keys(sacroiliacE).length === 0) sacroiliacE = null;

  return {
    patient_id:                    patientId,
    visit_date:                    extracted.visit_date || new Date().toISOString().slice(0, 10),
    visit_type:                    visitType,
    rheumatologic_history_summary: vs.raccordo    || null,
    interval_history:              vs.anamnesi    || null,
    physical_exam:                 vs.esame_obj   || null,
    physical_exam_joint_exam:      jointExam,
    physical_exam_sacroiliac:      sacroiliacE,
    conclusions:                   vs.conclusioni || null,
    referral_note:                 vs.indicazioni || null,
    exit_therapy_text:             vs.terapia_uscita || null,
    labs_imaging:                  labs_imaging_v,
    requested_tests:               wantReqTests ? extracted.requested_tests : null,
    home_therapies_text:           extracted.profilo_generale?.terapia_domiciliare || null,
    status:                        "completed",
  };
}

export function buildTherapyUpsertPayload(t, patientId, importedVisitId) {
  const isHistorical   = t.status === "discontinued" && t._action === "new_episode";
  // Solo un avvio esplicito nella visita corrente non è pre_existing; tutto il
  // resto (continuità, storico, cambio dose) viene dall'anamnesi e non deve
  // contare come "avviata oggi" nel contatore TherapySection.
  const isGenuineStart = t.status === "active"
    && t._action === "new_episode"
    && t._visit_event === "start";
  return {
    patient_id:             patientId,
    drug_name:              t.drug_name,
    category:               t.category || "other",
    dose:                   t.dose || null,
    frequency:              t.frequency || null,
    route:                  t.route || null,
    start_date:             t.start_date || null,
    end_date:               t.end_date || null,
    status:                 t.status || "active",
    discontinuation_reason: t.discontinuation_reason || null,
    notes:                  t.notes || null,
    raw_string:             t.raw_string || null,
    visit_id:               importedVisitId || null,
    therapy_event:          isGenuineStart ? null : "pre_existing",
    ...(isHistorical ? { event_type_override: "historical_exposure" } : {}),
  };
}

export function buildTherapyContinuityPayload(t, patientId, importedVisitId, today) {
  return {
    patient_id:    patientId,
    drug_name:     t.drug_name,
    category:      t.category || "other",
    dose:          t.dose || null,
    frequency:     t.frequency || null,
    route:         t.route || null,
    start_date:    t.start_date || today,
    status:        "active",
    visit_id:      importedVisitId || null,
    therapy_event: "pre_existing",
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
