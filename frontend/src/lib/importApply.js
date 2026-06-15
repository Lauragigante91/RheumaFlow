import {
  patientsApi,
  assessmentsApi,
  instrumentalExamsApi,
  scleroProfileApi,
  therapiesApi,
  labExamsApi,
  diseaseProfileApi,
  workupVisitsApi,
  clinicalEventsApi,
} from "./api";
import {
  buildWorkupVisitPayload,
  buildTherapyUpsertPayload,
  buildTherapyContinuityPayload,
  buildAssessmentPayload,
  buildLabExamPayload,
  buildInstrumentalExamPayload,
} from "./importPayloadBuilders";

export function apiErrMsg(e, label) {
  const detail = e?.response?.data?.detail;
  let msg = "";
  if (Array.isArray(detail)) {
    msg = detail.map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ");
  } else if (typeof detail === "string") {
    msg = detail;
  } else {
    msg = e?.message || "errore sconosciuto";
  }
  console.error(`[Import] ${label} FAILED — status ${e?.response?.status}:`, detail ?? e);
  return `${label}: ${msg}`;
}

function isEmptyVal(v) {
  return v === null || v === undefined || v === "";
}

export function mergeFreeTextConservative(existingText, incomingText) {
  const norm = (s) =>
    (s || "").toString().toLowerCase().replace(/\s+/g, " ").replace(/[.;,]+$/g, "").trim();
  const splitLines = (s) =>
    (s || "").toString().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const existingLines = splitLines(existingText);
  const seen = new Set(existingLines.map(norm));
  const out = [...existingLines];
  for (const line of splitLines(incomingText)) {
    const n = norm(line);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(line);
  }
  return out.join("\n");
}

export function fillMissingOnly(existing, incoming, options = {}) {
  const { skipFalse = false } = options;
  const out = { ...(existing || {}) };
  Object.entries(incoming || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") return;
    if (skipFalse && v === false) return;
    if (isEmptyVal(out[k])) out[k] = v;
  });
  return out;
}

export async function applyOneDraft(extracted, patient, selected, visitType, sourceFilename = null) {
  const errors = [];
  let updates = 0;

  if (selected.patient && extracted.patient) {
    try {
      const patch = {};
      const pp = extracted.patient;
      ["nome", "cognome", "data_nascita", "sesso", "codice_fiscale"].forEach((k) => {
        if (pp[k] && pp[k] !== patient[k]) patch[k] = pp[k];
      });
      if (pp.diagnosi) {
        const mergedDx = mergeFreeTextConservative(patient.diagnosi, pp.diagnosi);
        if (mergedDx && mergedDx !== (patient.diagnosi || "")) patch.diagnosi = mergedDx;
      }
      if (Object.keys(patch).length > 0) {
        await patientsApi.update(patient.id, patch);
        updates += 1;
      }
    } catch (e) { errors.push(apiErrMsg(e, "Dati paziente")); }
  }

  let importedVisitId = null;
  const wantVisitSections = selected.visit_sections && extracted.visit_sections &&
    Object.values(extracted.visit_sections).some(Boolean);
  const wantExamImaging = selected.exam_imaging && Array.isArray(extracted.exam_imaging) &&
    extracted.exam_imaging.filter(x => !x._skip).length > 0;

  if (wantVisitSections) {
    try {
      const payload = buildWorkupVisitPayload(extracted, patient.id, visitType, wantExamImaging);
      const createdVisit = await workupVisitsApi.create(patient.id, payload);
      importedVisitId = createdVisit?.id || null;
      updates += 1;
    } catch (e) { errors.push(apiErrMsg(e, "Sezioni visita")); }
  }

  if (selected.assessments && Array.isArray(extracted.assessments)) {
    const fallbackDate = extracted.visit_date || new Date().toISOString().slice(0, 10);
    for (const a of extracted.assessments.filter(x => !x._skip)) {
      if (!a.index_type) continue;
      try {
        await assessmentsApi.create(
          buildAssessmentPayload(a, patient.id, fallbackDate, importedVisitId, visitType, sourceFilename)
        );
        updates += 1;
      } catch (e) { errors.push(apiErrMsg(e, `Score ${a.index_type}`)); }
    }
  }

  if (selected.therapies && Array.isArray(extracted.therapies)) {
    const today = new Date().toISOString().slice(0, 10);

    for (const t of extracted.therapies.filter(x => !x._skip)) {
      if (!t.drug_name) continue;
      try {
        await therapiesApi.upsert(buildTherapyUpsertPayload(t, patient.id, importedVisitId));
        updates += 1;
      } catch (e) { errors.push(apiErrMsg(e, `Terapia ${t.drug_name}`)); }
    }

    for (const t of extracted.therapies.filter(x => x._skip && x._call_upsert)) {
      if (!t.drug_name) continue;
      try {
        await therapiesApi.upsert(buildTherapyContinuityPayload(t, patient.id, importedVisitId, today));
      } catch (_) { /* continued events are non-critical — silently skip */ }
    }
  }

  if (selected.lab_exams && Array.isArray(extracted.lab_exams)) {
    for (const ex of extracted.lab_exams.filter(x => !x._skip)) {
      try {
        const payload = buildLabExamPayload(ex, patient.id, sourceFilename);
        if (Object.keys(payload.values).length === 0) continue;
        await labExamsApi.upsert(payload);
        updates += 1;
      } catch (e) { errors.push(apiErrMsg(e, `Esami lab ${ex.date || ""}`)); }
    }
  }

  if (selected.instrumental_findings && Array.isArray(extracted.instrumental_findings)) {
    const visitDate = extracted.visit_date || new Date().toISOString().slice(0, 10);
    for (const f of extracted.instrumental_findings.filter(x => !x._skip)) {
      try {
        await instrumentalExamsApi.create(buildInstrumentalExamPayload(f, patient.id, visitDate, null));
        updates += 1;
      } catch (e) { errors.push(apiErrMsg(e, `Esame strum. ${f.examLabel}`)); }
    }
  }

  if (selected.exam_imaging && Array.isArray(extracted.exam_imaging)) {
    const visitDate = extracted.visit_date || new Date().toISOString().slice(0, 10);
    for (const f of extracted.exam_imaging.filter(x => !x._skip)) {
      try {
        await instrumentalExamsApi.create(buildInstrumentalExamPayload(f, patient.id, visitDate, "imaging_report"));
        updates += 1;
      } catch (e) { errors.push(apiErrMsg(e, `Esame (visione) ${f.examLabel}`)); }
    }
  }

  if (selected.sclero_profile && extracted.sclero_profile) {
    try {
      const sp = extracted.sclero_profile;
      const hasContent = Object.values(sp).some((v) => v && Object.keys(v || {}).length > 0);
      if (hasContent) {
        let existing = await scleroProfileApi.get(patient.id).catch(() => null);
        existing = existing || {};
        const merged = {};
        ["cutaneous", "antibody", "vascular", "ild", "pah", "gi", "msk"].forEach((sec) => {
          const out = fillMissingOnly(existing[sec], sp[sec]);
          if (Object.keys(out).length > 0) merged[sec] = out;
        });
        await scleroProfileApi.upsert(patient.id, merged);
        updates += 1;
      }
    } catch (e) { errors.push(apiErrMsg(e, "Profilo SSc")); }
  }

  if (selected.ra_profile && extracted.ra_profile) {
    try {
      const existing = await diseaseProfileApi.get(patient.id, "ra").catch(() => null);
      const existingData = existing?.data || {};
      const merged = fillMissingOnly(existingData, extracted.ra_profile);
      await diseaseProfileApi.upsert(patient.id, "ra", merged);
      updates += 1;
    } catch (e) { errors.push(apiErrMsg(e, "Profilo AR")); }
  }

  if (selected.spa_profile && extracted.spa_profile) {
    try {
      const existing = await diseaseProfileApi.get(patient.id, "spa").catch(() => null);
      const existingData = existing?.data || {};
      const merged = fillMissingOnly(existingData, extracted.spa_profile, { skipFalse: true });
      await diseaseProfileApi.upsert(patient.id, "spa", merged);
      updates += 1;
    } catch (e) { errors.push(apiErrMsg(e, "Profilo SpA")); }
  }

  if (selected.sle_profile && extracted.sle_profile) {
    try {
      const existing = await diseaseProfileApi.get(patient.id, "sle").catch(() => null);
      const existingData = existing?.data || {};
      const { antibodies, ...rest } = extracted.sle_profile;
      const merged = fillMissingOnly(existingData, rest);
      if (antibodies) {
        merged.antibodies = fillMissingOnly(existingData.antibodies, antibodies);
      }
      await diseaseProfileApi.upsert(patient.id, "sle", merged);
      updates += 1;
    } catch (e) { errors.push(apiErrMsg(e, "Profilo LES")); }
  }

  if (selected.profilo_generale && extracted.profilo_generale) {
    try {
      const pg = extracted.profilo_generale;
      const patch = {};
      const mergeField = (field, incoming) => {
        if (!incoming) return;
        const merged = mergeFreeTextConservative(patient[field], incoming);
        if (merged && merged !== (patient[field] || "")) patch[field] = merged;
      };
      mergeField("anamnesi_fisiologica", pg.anamnesi_fisiologica);
      mergeField("anamnesi_familiare", pg.anamnesi_familiare);
      mergeField("terapia_domiciliare", pg.terapia_domiciliare);
      const _hasComorbItems = (extracted.comorbidita || []).filter(x => !x._skip).length > 0;
      const _hasIntollItems = (extracted.intolleranze || []).filter(x => !x._skip).length > 0;
      if (pg.comorbidita_apr && !_hasComorbItems) mergeField("comorbidita_apr", pg.comorbidita_apr);
      if (pg.allergie && !_hasIntollItems) mergeField("allergie_testo", pg.allergie);
      if (Object.keys(patch).length > 0) {
        await patientsApi.patch(patient.id, patch);
        updates += 1;
      }
    } catch (e) { errors.push(apiErrMsg(e, "Profilo generale")); }
  }

  if (selected.comorbidita && extracted.comorbidita?.length) {
    try {
      const confirmed = (extracted.comorbidita || []).filter(x => !x._skip);
      if (confirmed.length > 0) {
        const incoming = confirmed.map(x => x.text).filter(Boolean).join("\n");
        const merged = mergeFreeTextConservative(patient.comorbidita_apr, incoming);
        if (merged && merged !== (patient.comorbidita_apr || "")) {
          await patientsApi.patch(patient.id, { comorbidita_apr: merged });
          updates += 1;
        }
      }
    } catch (e) { errors.push(apiErrMsg(e, "Comorbidità")); }
  }

  if (selected.intolleranze && extracted.intolleranze?.length) {
    try {
      const confirmed = (extracted.intolleranze || []).filter(x => !x._skip);
      if (confirmed.length > 0) {
        const incoming = confirmed.map(x => x.drug + (x.reason ? ` (${x.reason})` : "")).filter(Boolean).join("\n");
        const merged = mergeFreeTextConservative(patient.allergie_testo, incoming);
        if (merged && merged !== (patient.allergie_testo || "")) {
          await patientsApi.patch(patient.id, { allergie_testo: merged });
          updates += 1;
        }
      }
    } catch (e) { errors.push(apiErrMsg(e, "Intolleranze")); }
  }

  if (selected.raccordo_events) {
    const confirmed = (extracted.raccordo_events || []).filter(e => !e._skip);
    if (process.env.NODE_ENV !== "production") {
      console.log("[import][save] eventi raccordo da salvare:", confirmed.length);
    }
    if (confirmed.length > 0) {
      try {
        await clinicalEventsApi.batchCreate(patient.id, {
          patient_id: patient.id,
          events: confirmed.map(({ _id, _skip, id, _status, _statusReason, ...e }) => ({
            ...e,
            source_filename: e.source_filename || sourceFilename || null,
          })),
          visit_id: importedVisitId || null,
        });
        updates += 1;
      } catch (e) { errors.push(apiErrMsg(e, "Cronologia raccordo")); }
    }
  }

  return { updates, errors };
}
