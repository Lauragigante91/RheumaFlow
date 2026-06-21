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
import { mapDiagnosisToControlled, CONTROLLED_DIAGNOSES } from "./diagnosisSuggestions";
import {
  buildWorkupVisitPayload,
  buildTherapyUpsertPayload,
  buildTherapyContinuityPayload,
  buildAssessmentPayload,
  buildLabExamPayload,
  buildInstrumentalExamPayload,
} from "./importPayloadBuilders";

// Restituisce true se il testo è già una label diagnostica pulita (breve, senza
// marcatori narrativi) — in quel caso viene preservato così com'è (non mappato
// alla voce del dizionario, che potrebbe essere meno specifica).
function isCleanDiagnosis(text) {
  if (!text) return false;
  if (CONTROLLED_DIAGNOSES.includes(text)) return true;
  if (text.length >= 80) return false;
  return !/\b(posta nel|trattata|in terapia|seguita per|con diagnosi di|affetto da|paziente con|dal \d{4}|per cui|mediante)\b/i.test(text);
}

// Restituisce true se il medico ha scelto di ignorare questo campo longitudinale
// (ovvero _longitudinal[key]._skip === true dopo l'interazione nella review UI).
function shouldSkipLongitudinalField(draft, key) {
  const longit = draft._longitudinal;
  if (!Array.isArray(longit)) return false;
  const entry = longit.find(f => f.key === key);
  if (!entry) return false;
  return entry._skip === true;
}

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

function normDrugName(name) {
  return (name || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function buildTherapyStartEvent(t, visitDate, sourceFilename) {
  const detail = [t.dose, t.route, t.frequency].filter(Boolean).join(" ").trim();
  return {
    event_type: "therapy_start",
    categoria: "terapia",
    titolo: `Avvio ${t.drug_name}`,
    date_value: visitDate,
    date_precision: "exact",
    drug_name: t.drug_name,
    drug_canonical: normDrugName(t.drug_name),
    drug_category: t.category || null,
    detail: detail || null,
    source_origin: "generato_da_parser",
    source_filename: sourceFilename || null,
  };
}

export function mergeFreeTextConservative(existingText, incomingText) {
  const signature = (s) => {
    const norm = (s || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!norm) return "";
    return [...new Set(norm.split(" "))].sort().join(" ");
  };
  const splitLines = (s) =>
    (s || "").toString().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const existingLines = splitLines(existingText);
  const seen = new Set(existingLines.map(signature).filter(Boolean));
  const out = [...existingLines];
  for (const line of splitLines(incomingText)) {
    const sig = signature(line);
    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
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

export async function applyOneDraft(extracted, patient, selected, visitType, sourceFilename = null, options = {}) {
  const errors = [];
  let updates = 0;
  const skipPatientState = options.skipPatientState === true;

  if (!skipPatientState && selected.patient && extracted.patient) {
    try {
      const patch = {};
      const pp = extracted.patient;
      ["nome", "cognome", "data_nascita", "sesso", "codice_fiscale"].forEach((k) => {
        if (pp[k] && pp[k] !== patient[k]) patch[k] = pp[k];
      });
      if (pp.diagnosi && !shouldSkipLongitudinalField(extracted, "diagnosi")) {
        // Preserva label brevi e pulite; mappa solo frammenti narrativi lunghi.
        const toMerge = isCleanDiagnosis(pp.diagnosi) ? pp.diagnosi : mapDiagnosisToControlled(pp.diagnosi);
        if (toMerge) {
          const mergedDx = mergeFreeTextConservative(patient.diagnosi, toMerge);
          if (mergedDx && mergedDx !== (patient.diagnosi || "")) patch.diagnosi = mergedDx;
        }
      }
      if (Object.keys(patch).length > 0) {
        await patientsApi.update(patient.id, patch);
        updates += 1;
      }
    } catch (e) { errors.push(apiErrMsg(e, "Dati paziente")); }
  }

  let importedVisitId = null;
  const therapyStartEvents = [];
  const wantVisitSections = selected.visit_sections && extracted.visit_sections &&
    Object.values(extracted.visit_sections).some(Boolean);
  const wantExamImaging = selected.exam_imaging && Array.isArray(extracted.exam_imaging) &&
    extracted.exam_imaging.filter(x => !x._skip).length > 0;

  if (wantVisitSections) {
    try {
      const payload = buildWorkupVisitPayload(extracted, patient.id, visitType, wantExamImaging);
      const visitDateKey = (extracted.visit_date || "").slice(0, 10);
      const wantType = visitType || "follow_up";
      let existing = null;
      if (visitDateKey) {
        try {
          const list = await workupVisitsApi.list(patient.id);
          existing = (list || []).find(
            (v) =>
              (v.visit_date || "").slice(0, 10) === visitDateKey &&
              (v.visit_type || "follow_up") === wantType
          ) || null;
        } catch (_) {}
      }
      if (existing) {
        const targetId = existing.id || existing._id || null;
        const patch = {};
        Object.entries(payload).forEach(([k, v]) => {
          if (v === null || v === undefined || v === "") return;
          if (isEmptyVal(existing[k])) patch[k] = v;
        });
        if (targetId && Object.keys(patch).length > 0) {
          await workupVisitsApi.patch(targetId, patch);
        }
        importedVisitId = targetId;
      } else {
        const createdVisit = await workupVisitsApi.create(patient.id, payload);
        importedVisitId = createdVisit?.id || null;
      }
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
    const visitDate = extracted.visit_date || today;

    for (const t of extracted.therapies.filter(x => !x._skip)) {
      if (!t.drug_name) continue;
      try {
        await therapiesApi.upsert(buildTherapyUpsertPayload(t, patient.id, importedVisitId));
        updates += 1;
        if (t.status === "active" && (t._action === "new_episode" || !t._action)) {
          therapyStartEvents.push(buildTherapyStartEvent(t, visitDate, sourceFilename));
        }
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

  if (!skipPatientState && selected.profilo_generale && extracted.profilo_generale) {
    try {
      const pg = extracted.profilo_generale;
      const patch = {};
      const mergeField = (field, incoming) => {
        if (!incoming) return;
        const merged = mergeFreeTextConservative(patient[field], incoming);
        if (merged && merged !== (patient[field] || "")) patch[field] = merged;
      };
      if (!shouldSkipLongitudinalField(extracted, "anamnesi_fisiologica"))
        mergeField("anamnesi_fisiologica", pg.anamnesi_fisiologica);
      if (!shouldSkipLongitudinalField(extracted, "anamnesi_familiare"))
        mergeField("anamnesi_familiare", pg.anamnesi_familiare);
      if (!shouldSkipLongitudinalField(extracted, "terapia_domiciliare"))
        mergeField("terapia_domiciliare", pg.terapia_domiciliare);
      const _hasComorbItems = (extracted.comorbidita || []).filter(x => !x._skip).length > 0;
      const _hasIntollItems = (extracted.intolleranze || []).filter(x => !x._skip).length > 0;
      if (pg.comorbidita_apr && !_hasComorbItems && !shouldSkipLongitudinalField(extracted, "comorbidita_apr"))
        mergeField("comorbidita_apr", pg.comorbidita_apr);
      if (pg.allergie && !_hasIntollItems && !shouldSkipLongitudinalField(extracted, "allergie_testo"))
        mergeField("allergie_testo", pg.allergie);
      if (Object.keys(patch).length > 0) {
        await patientsApi.patch(patient.id, patch);
        updates += 1;
      }
    } catch (e) { errors.push(apiErrMsg(e, "Profilo generale")); }
  }

  if (!skipPatientState && selected.comorbidita && extracted.comorbidita?.length) {
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

  if (!skipPatientState && selected.intolleranze && extracted.intolleranze?.length) {
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

  const eventsToCreate = [];
  const raccordoStartDrugs = new Set();
  if (selected.raccordo_events) {
    const confirmed = (extracted.raccordo_events || []).filter(e => !e._skip);
    if (process.env.NODE_ENV !== "production") {
      console.log("[import][save] eventi raccordo da salvare:", confirmed.length);
    }
    for (const ev of confirmed) {
      if (ev.event_type === "therapy_start") {
        const k = normDrugName(ev.drug_canonical || ev.drug_name);
        if (k) raccordoStartDrugs.add(k);
      }
    }
    eventsToCreate.push(
      ...confirmed.map(({ _id, _skip, id, _status, _statusReason, ...e }) => ({
        ...e,
        source_filename: e.source_filename || sourceFilename || null,
      }))
    );
  }
  for (const ev of therapyStartEvents) {
    if (raccordoStartDrugs.has(ev.drug_canonical)) continue;
    eventsToCreate.push(ev);
  }

  const stampedEvents = eventsToCreate.map(ev => ({
    ...ev,
    visit_id: ev.visit_id !== undefined ? ev.visit_id : (importedVisitId || null),
  }));

  if (options.skipEventBatch) {
    return { updates, errors, pendingEvents: stampedEvents };
  }

  if (stampedEvents.length > 0) {
    try {
      await clinicalEventsApi.batchCreate(patient.id, {
        patient_id: patient.id,
        events: stampedEvents,
        visit_id: null,
      });
      updates += 1;
    } catch (e) { errors.push(apiErrMsg(e, "Cronologia clinica")); }
  }

  return { updates, errors, pendingEvents: [] };
}

const STATE_ANAGRAFICA = ["nome", "cognome", "data_nascita", "sesso", "codice_fiscale", "diagnosi"];
const STATE_PROFILE = ["anamnesi_fisiologica", "anamnesi_familiare", "terapia_domiciliare", "comorbidita_apr", "allergie_testo"];

const _OCR_HARD_RE = /[\uFFFD\u00BF\uFFFE\uFFFF]/g;
const _OCR_SOFT_RE = /[a-zA-Z\u00C0-\u024F]\d|\d[a-zA-Z\u00C0-\u024F]/g;
const _CONFLICT_PENALTY_DELTA = 0.05;
const _CONFLICT_LEN_MIN_RATIO = 0.8;
const _CONFLICT_OVERLAP_THRESHOLD = 0.6;

function _ocrPenalty(text) {
  if (!text || !text.length) return 1;
  const hard = (text.match(_OCR_HARD_RE) || []).length;
  const soft = (text.match(_OCR_SOFT_RE) || []).length;
  return (hard * 3 + soft) / text.length;
}

function _normWords(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function _wordOverlap(a, b) {
  const wa = new Set(_normWords(a));
  const wb = new Set(_normWords(b));
  if (!wa.size && !wb.size) return 1;
  if (!wa.size || !wb.size) return 0;
  let common = 0;
  for (const w of wa) { if (wb.has(w)) common++; }
  return common / Math.max(wa.size, wb.size);
}

export function selectBestCandidate(candidates) {
  const valid = (candidates || []).filter(c => c && c.value && c.value.trim());
  if (!valid.length) return null;
  if (valid.length === 1) {
    return {
      selected: {
        value: valid[0].value,
        source_visit_date: valid[0].source_visit_date || null,
        source_file: valid[0].source_file || null,
        reason_selected: "solo_candidato",
      },
      reason: "solo_candidato",
      conflicts: [],
      warn: false,
    };
  }
  const scored = valid.map(c => ({ ...c, _penalty: _ocrPenalty(c.value) }));
  scored.sort((a, b) => {
    const dp = a._penalty - b._penalty;
    if (Math.abs(dp) > _CONFLICT_PENALTY_DELTA) return dp;
    return b.value.length - a.value.length;
  });
  const winner = scored[0];
  const runners = scored.slice(1);
  const conflicts = runners.filter(r => {
    const penaltyClose = Math.abs(r._penalty - winner._penalty) <= _CONFLICT_PENALTY_DELTA;
    const lenMin = Math.min(winner.value.length, r.value.length);
    const lenMax = Math.max(winner.value.length, r.value.length);
    const lenSimilar = lenMax > 0 && (lenMin / lenMax) >= _CONFLICT_LEN_MIN_RATIO;
    const contentDiverges = _wordOverlap(winner.value, r.value) < _CONFLICT_OVERLAP_THRESHOLD;
    return penaltyClose && lenSimilar && contentDiverges;
  });
  const penaltyGap = runners.length > 0 ? (runners[0]._penalty - winner._penalty) : 1;
  let reason_selected;
  if (penaltyGap > _CONFLICT_PENALTY_DELTA) {
    reason_selected = "ocr_migliore";
  } else if (conflicts.length > 0) {
    reason_selected = "conflitto";
  } else {
    reason_selected = "piu_completo";
  }
  const { _penalty: _wp, ...winnerRest } = winner;
  return {
    selected: { ...winnerRest, reason_selected },
    reason: reason_selected,
    conflicts: conflicts.map(({ _penalty: _, ...r }) => r),
    warn: conflicts.length > 0,
  };
}

function draftComorbidita(draft, selected) {
  if (selected.comorbidita) {
    const items = (draft.comorbidita || [])
      .filter((x) => !x._skip)
      .map((x) => x.text)
      .filter(Boolean);
    if (items.length > 0) return items.join("\n");
  }
  if (selected.profilo_generale && draft.profilo_generale?.comorbidita_apr) {
    return draft.profilo_generale.comorbidita_apr;
  }
  return "";
}

function draftAllergie(draft, selected) {
  if (selected.intolleranze) {
    const items = (draft.intolleranze || [])
      .filter((x) => !x._skip)
      .map((x) => x.drug + (x.reason ? ` (${x.reason})` : ""))
      .filter(Boolean);
    if (items.length > 0) return items.join("\n");
  }
  if (selected.profilo_generale && draft.profilo_generale?.allergie) {
    return draft.profilo_generale.allergie;
  }
  return "";
}

export function extractDraftState(draft, selected = {}) {
  const out = {};
  const pp = draft.patient || {};
  if (selected.patient) {
    STATE_ANAGRAFICA.forEach((k) => { if (pp[k]) out[k] = pp[k]; });
  }
  const pg = draft.profilo_generale || {};
  if (selected.profilo_generale) {
    if (pg.anamnesi_fisiologica) out.anamnesi_fisiologica = pg.anamnesi_fisiologica;
    if (pg.anamnesi_familiare)   out.anamnesi_familiare   = pg.anamnesi_familiare;
    if (pg.terapia_domiciliare)  out.terapia_domiciliare  = pg.terapia_domiciliare;
    if (pg.diagnosi) {
      const toMerge = isCleanDiagnosis(pg.diagnosi) ? pg.diagnosi : mapDiagnosisToControlled(pg.diagnosi);
      if (toMerge) out.diagnosi = toMerge;
    }
  }
  const comorb = draftComorbidita(draft, selected);
  if (comorb) out.comorbidita_apr = comorb;
  const allerg = draftAllergie(draft, selected);
  if (allerg) out.allergie_testo = allerg;
  return out;
}

export function computeLongitudinalState(draftsAsc = []) {
  const perField = {};
  for (const { draft, selected } of draftsAsc) {
    const s = extractDraftState(draft, selected || {});
    const date = draft.visit_date || null;
    const file = draft.source_filename || null;
    Object.entries(s).forEach(([k, v]) => {
      if (!v) return;
      if (!perField[k]) perField[k] = [];
      perField[k].push({ value: v, source_visit_date: date, source_file: file });
    });
  }
  const result = {};
  for (const [k, candidates] of Object.entries(perField)) {
    const resolved = selectBestCandidate(candidates);
    if (resolved) result[k] = resolved;
  }
  return result;
}

export async function applyLongitudinalState(draftsAsc, patient, overrides = {}) {
  const errors = [];
  let updates = 0;
  const state = computeLongitudinalState(draftsAsc);
  const updatePatch = {};
  const patchPatch = {};
  const _shouldWrite = (existingVal, incoming) => {
    if (!incoming) return false;
    if (incoming === (existingVal || "")) return false;
    if (existingVal) {
      const ep = _ocrPenalty(existingVal);
      const ip = _ocrPenalty(incoming);
      if (ip > ep + _CONFLICT_PENALTY_DELTA) return false;
      if (ep <= _CONFLICT_PENALTY_DELTA && incoming.length < existingVal.length * 0.8) return false;
    }
    return true;
  };
  STATE_ANAGRAFICA.forEach((k) => {
    if (overrides[k] !== undefined) {
      if (overrides[k] && overrides[k] !== (patient[k] || "")) updatePatch[k] = overrides[k];
    } else {
      const incoming = state[k]?.selected?.value;
      if (_shouldWrite(patient[k], incoming)) updatePatch[k] = incoming;
    }
  });
  const RECENCY_FIELDS = new Set(["terapia_domiciliare"]);
  STATE_PROFILE.forEach((k) => {
    if (overrides[k] !== undefined) {
      if (overrides[k] && overrides[k] !== (patient[k] || "")) patchPatch[k] = overrides[k];
    } else {
      let incoming;
      if (RECENCY_FIELDS.has(k)) {
        for (let i = draftsAsc.length - 1; i >= 0; i--) {
          const s = extractDraftState(draftsAsc[i].draft, draftsAsc[i].selected || {});
          if (s[k]) { incoming = s[k]; break; }
        }
      } else {
        incoming = state[k]?.selected?.value;
      }
      if (_shouldWrite(patient[k], incoming)) patchPatch[k] = incoming;
    }
  });
  if (Object.keys(updatePatch).length > 0) {
    try { await patientsApi.update(patient.id, updatePatch); updates += 1; }
    catch (e) { errors.push(apiErrMsg(e, "Dati paziente")); }
  }
  if (Object.keys(patchPatch).length > 0) {
    try { await patientsApi.patch(patient.id, patchPatch); updates += 1; }
    catch (e) { errors.push(apiErrMsg(e, "Profilo generale")); }
  }
  const fieldConflicts = Object.entries(state)
    .filter(([, res]) => res.warn)
    .map(([field, res]) => ({ field, selected: res.selected, conflicts: res.conflicts }));
  return { updates, errors, fieldConflicts };
}

export async function applyDraftBatch(toApply, patient, opts = {}) {
  const errors = [];
  let updates = 0;
  const allPendingEvents = [];
  for (let i = 0; i < toApply.length; i++) {
    const v = toApply[i];
    opts.onProgress?.({ current: i + 1, total: toApply.length, label: v.label });
    const vType = v.draft?.visit_type || v.visitType || opts.defaultVisitType || "follow_up";
    const res = await applyOneDraft(
      v.draft, patient, v.selected, vType, v.draft?.source_filename || null,
      { skipPatientState: true, skipEventBatch: true }
    );
    updates += res.updates;
    errors.push(...res.errors);
    allPendingEvents.push(...(res.pendingEvents || []));
  }
  if (allPendingEvents.length > 0) {
    try {
      await clinicalEventsApi.batchCreate(patient.id, {
        patient_id: patient.id,
        events: allPendingEvents,
        visit_id: null,
      });
      updates += 1;
    } catch (e) { errors.push(apiErrMsg(e, "Cronologia clinica")); }
  }
  const longitudinal = await applyLongitudinalState(
    toApply.map((v) => ({ draft: v.draft, selected: v.selected })),
    patient,
    opts.fieldOverrides || {}
  );
  updates += longitudinal.updates;
  errors.push(...longitudinal.errors);
  return { updates, errors, fieldConflicts: longitudinal.fieldConflicts || [] };
}
