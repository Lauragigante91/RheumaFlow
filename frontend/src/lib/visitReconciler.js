// ── Visit Reconciler ─────────────────────────────────────────────────────────
// Compares extracted multi-visit drafts against existing patient data and
// annotates each item with a status: new / duplicate / continuity / conflict /
// update / uncertain. Also deduplicates across letters within the same batch.

export const ITEM_STATUS = {
  NEW:        "new",
  DUPLICATE:  "duplicate",
  CONTINUITY: "continuity",
  CONFLICT:   "conflict",
  UPDATE:     "update",
  UNCERTAIN:  "uncertain",
};

export const STATUS_META = {
  new:        { label: "Nuovo dato",        color: "teal",   dot: "#0d9488", desc: "Verrà salvato" },
  duplicate:  { label: "Già presente",      color: "gray",   dot: "#9ca3af", desc: "Non salvato di nuovo" },
  continuity: { label: "Continuità",        color: "blue",   dot: "#3b82f6", desc: "Già registrato — continuità confermata" },
  conflict:   { label: "Possibile conflitto",color: "red",   dot: "#ef4444", desc: "Valore diverso da quello esistente" },
  update:     { label: "Aggiornamento",     color: "amber",  dot: "#f59e0b", desc: "Aggiorna il dato precedente" },
  uncertain:  { label: "Da confermare",     color: "violet", dot: "#8b5cf6", desc: "Dato dubbio — verifica prima di salvare" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normDrug(name) {
  return (name || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function normDate(d) {
  return (d || "").slice(0, 10);
}

/**
 * Extract the numeric mg value from a free-text dose string.
 * Returns null if no clear mg value can be read (avoids false positives).
 * Examples: "15 mg/sett" → 15  |  "1000 mg e.v." → 1000  |  "2 cp" → null
 */
function normDoseMg(dose) {
  if (!dose) return null;
  const m = dose.match(/(\d+(?:[.,]\d+)?)\s*mg/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

function normDoseFull(dose) {
  if (!dose) return null;
  const s = String(dose).toLowerCase().replace(/\s+/g, "").replace(/[.,;]/g, "");
  return s || null;
}

function normFreq(freq) {
  if (!freq) return null;
  const s = String(freq).toLowerCase().trim().replace(/\s+/g, " ").replace(/[.,;]/g, "");
  return s || null;
}

function normRoute(route) {
  if (!route) return null;
  const s = String(route).toLowerCase().replace(/\s+/g, "").replace(/[.\-]/g, "");
  return s || null;
}

function bothDiffer(a, b) {
  return a !== null && b !== null && a !== b;
}

/**
 * Derive effective relevance from an existing therapy document.
 * Falls back to category-based heuristic for legacy docs without the field.
 */
function getEffectiveRelevance(existing) {
  if (existing.relevance) return existing.relevance;
  const cat = existing.category || "other";
  if (["csDMARD", "bDMARD", "tsDMARD", "glucocorticoid"].includes(cat)) return "high";
  if (cat === "NSAID") return "medium";
  return "low";
}

function buildTherapyMap(therapies) {
  const map = new Map();
  for (const t of therapies || []) {
    const key = normDrug(t.drug_name);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev || t.status === "active") map.set(key, t);
  }
  return map;
}

function buildAssessmentSet(assessments) {
  const set = new Set();
  for (const a of assessments || []) {
    if (a.index_type && a.date) set.add(`${a.index_type}::${normDate(a.date)}`);
  }
  return set;
}

function buildLabSet(labs) {
  const set = new Set();
  for (const l of labs || []) {
    set.add(`${normDate(l.date)}::${l.panel || "custom"}`);
  }
  return set;
}

function normEventText(s) {
  return (s || "").toString().toLowerCase().trim().replace(/\s+/g, " ");
}

function eventKey(e) {
  const date = normDate(e.date_value || e.date_estimated);
  const drug = e.drug_canonical || e.to_drug || e.from_drug || "";
  const text = normEventText(e.manifestation || e.detail);
  return `${e.event_type || ""}::${date}::${normEventText(drug)}::${text}`;
}

function buildEventSet(events) {
  const set = new Set();
  for (const e of events || []) {
    if (!e || !e.event_type) continue;
    set.add(eventKey(e));
  }
  return set;
}

// ── Core reconciliation ───────────────────────────────────────────────────────

export function reconcileDrafts(drafts, existingData) {
  const {
    therapies:        existingTherapies    = [],
    assessments:      existingAssessments  = [],
    lab_exams:        existingLabs         = [],
    disease_profiles: existingProfiles     = {},
    sclero_profile:   existingSclero       = null,
    clinical_events:  existingEvents       = [],
  } = existingData;

  const therapyMap    = buildTherapyMap(existingTherapies);
  const assessmentSet = buildAssessmentSet(existingAssessments);
  const labSet        = buildLabSet(existingLabs);
  const eventSet      = buildEventSet(existingEvents);

  // Cross-draft deduplication trackers (shared across all drafts)
  const seenDrugs       = new Set();
  const seenAssessments = new Set();
  const seenLabs        = new Set();
  const seenEvents      = new Set();

  return drafts.map((draft, draftIdx) => {
    const out = { ...draft };

    // ── Therapies ───────────────────────────────────────────────────────────
    if (Array.isArray(draft.therapies)) {
      out.therapies = draft.therapies.map(t => {
        const key = normDrug(t.drug_name);
        if (!key) return { ...t, _status: ITEM_STATUS.UNCERTAIN, _statusReason: "Nome farmaco non riconoscibile" };

        const existing = therapyMap.get(key);

        // Already scheduled by a previous draft in this batch
        if (seenDrugs.has(key)) {
          // Eccezione: se questa lettera segnala sospensione, non si può ignorare
          // (es. visita 1 → Colchicina attiva, visita 2 → Colchicina sospesa)
          if (t.status === "discontinued") {
            return {
              ...t,
              _status: ITEM_STATUS.UPDATE,
              _statusReason: `Lettera precedente la registra attiva — questa segnala sospensione${t.discontinuation_reason ? `: ${t.discontinuation_reason}` : ""}`,
              _skip: false,
              _action: "discontinue",
            };
          }
          return {
            ...t,
            _status: ITEM_STATUS.CONTINUITY,
            _statusReason: "Presente in un'altra lettera del batch — continuità",
            _skip: true,
          };
        }

        if (existing) {
          if (existing.status === "active") {
            // ── Bug fix 1: suspension not silently ignored ─────────────────
            if (t.status === "discontinued") {
              seenDrugs.add(key);
              return {
                ...t,
                _status: ITEM_STATUS.UPDATE,
                _statusReason: `Attiva in DB — lettera segnala sospensione${t.discontinuation_reason ? `: ${t.discontinuation_reason}` : ""}`,
                _skip: false,
                _action: "discontinue",
                _existing_id: existing.id,
              };
            }

            // ── Bug fix 2: dose change (mg) not silently ignored ───────────
            const existingMg = normDoseMg(existing.dose);
            const newMg      = normDoseMg(t.dose);
            if (existingMg !== null && newMg !== null && existingMg !== newMg) {
              seenDrugs.add(key);
              return {
                ...t,
                _status: ITEM_STATUS.CONFLICT,
                _statusReason: `Cambio dose: ${existing.dose} → ${t.dose}`,
                _skip: false,
                _action: "dose_change",
                _existing_id: existing.id,
                _dose_before: existing.dose,
              };
            }

            // ── Regime change: posologia (testo), frequenza o via ──────────
            // Confronto conservativo: scatta solo se entrambi i valori sono
            // presenti e differiscono. Frequency/route/formulazione non devono
            // mai passare come continuità silenziosa.
            const doseChanged  = bothDiffer(normDoseFull(existing.dose), normDoseFull(t.dose));
            const freqChanged  = bothDiffer(normFreq(existing.frequency), normFreq(t.frequency));
            const routeChanged = bothDiffer(normRoute(existing.route), normRoute(t.route));
            if (doseChanged || freqChanged || routeChanged) {
              seenDrugs.add(key);
              const parts = [];
              if (freqChanged)  parts.push(`frequenza: ${existing.frequency} → ${t.frequency}`);
              if (routeChanged) parts.push(`via: ${existing.route} → ${t.route}`);
              if (doseChanged)  parts.push(`posologia: ${existing.dose} → ${t.dose}`);
              return {
                ...t,
                _status: ITEM_STATUS.CONFLICT,
                _statusReason: `Cambio di regime — ${parts.join("; ")}`,
                _skip: false,
                _action: "regimen_change",
                _existing_id: existing.id,
                _dose_before: existing.dose,
                _frequency_before: existing.frequency || null,
                _route_before: existing.route || null,
              };
            }

            // ── Simple continuity ─────────────────────────────────────────
            // High-relevance drugs (DMARDs, biologics, GC) record a "continued"
            // event even on continuity, to document the visit confirmation.
            // Low/medium relevance drugs skip continued events to avoid noise.
            seenDrugs.add(key);
            const relevance = getEffectiveRelevance(existing);
            return {
              ...t,
              _status: ITEM_STATUS.CONTINUITY,
              _statusReason: `Già attiva nel profilo${existing.dose ? ` (${existing.dose})` : ""}`,
              _skip: true,
              _call_upsert: relevance === "high",
              _existing_id: existing.id,
              _action: "continued",
            };
          }

          if (existing.status === "discontinued" || existing.status === "paused") {
            if (t.status === "active") {
              seenDrugs.add(key);
              return {
                ...t,
                _status: ITEM_STATUS.UPDATE,
                _statusReason: "Era sospesa — risulta ripresa in questa lettera",
                _skip: false,
                _action: "new_episode",
              };
            }
            // Letter also says discontinued — already recorded
            return {
              ...t,
              _status: ITEM_STATUS.DUPLICATE,
              _statusReason: "Già registrata come sospesa",
              _skip: true,
            };
          }
        }

        seenDrugs.add(key);
        return {
          ...t,
          _status: ITEM_STATUS.NEW,
          _statusReason: "Non presente nel profilo",
          _action: "new_episode",
        };
      });
    }

    // ── Assessments ─────────────────────────────────────────────────────────
    if (Array.isArray(draft.assessments)) {
      out.assessments = draft.assessments.map(a => {
        if (!a.index_type) return { ...a, _status: ITEM_STATUS.UNCERTAIN, _statusReason: "Tipo indice non riconosciuto" };
        const key = `${a.index_type}::${normDate(a.date)}`;

        if (assessmentSet.has(key)) {
          return { ...a, _status: ITEM_STATUS.DUPLICATE, _statusReason: "Già salvato con questa data e indice", _skip: true };
        }
        if (seenAssessments.has(key)) {
          return { ...a, _status: ITEM_STATUS.DUPLICATE, _statusReason: "Duplicato in un'altra lettera del batch", _skip: true };
        }

        seenAssessments.add(key);
        return { ...a, _status: ITEM_STATUS.NEW };
      });
    }

    // ── Lab exams ───────────────────────────────────────────────────────────
    if (Array.isArray(draft.lab_exams)) {
      out.lab_exams = draft.lab_exams.map(l => {
        const panel = l.panel || l.category || "custom";
        const key   = `${normDate(l.date)}::${panel}`;

        if (labSet.has(key)) {
          return { ...l, _status: ITEM_STATUS.DUPLICATE, _statusReason: "Pannello già importato per questa data", _skip: true };
        }
        if (seenLabs.has(key)) {
          return { ...l, _status: ITEM_STATUS.DUPLICATE, _statusReason: "Duplicato in un'altra lettera del batch", _skip: true };
        }

        seenLabs.add(key);
        return { ...l, _status: ITEM_STATUS.NEW };
      });
    }

    // ── Raccordo events (cronologia longitudinale) ──────────────────────────
    // La cronologia anamnestica (esordio, remissione, stop/start) si ripete in
    // ogni lettera del batch: senza deduplica ogni evento verrebbe creato una
    // volta per PDF. Si confronta contro la cronologia già salvata e contro gli
    // altri draft dello stesso import.
    if (Array.isArray(draft.raccordo_events)) {
      out.raccordo_events = draft.raccordo_events.map(e => {
        if (!e.event_type) return e;
        const key = eventKey(e);

        if (eventSet.has(key)) {
          return { ...e, _status: ITEM_STATUS.DUPLICATE, _statusReason: "Evento già presente nella cronologia", _skip: true };
        }
        if (seenEvents.has(key)) {
          return { ...e, _status: ITEM_STATUS.DUPLICATE, _statusReason: "Duplicato in un'altra lettera del batch", _skip: true };
        }

        seenEvents.add(key);
        return { ...e, _status: ITEM_STATUS.NEW };
      });
    }

    // ── Disease profiles ────────────────────────────────────────────────────
    // Annotate the entire profile section with a status (field-level shown in UI)

    if (draft.ra_profile) {
      const ex = existingProfiles?.ra?.data || {};
      const hasConflict = Object.entries(draft.ra_profile).some(([k, v]) =>
        v != null && ex[k] != null && ex[k] !== v
      );
      const hasNew = Object.entries(draft.ra_profile).some(([k, v]) =>
        v != null && ex[k] == null
      );
      out._ra_profile_status = hasConflict
        ? ITEM_STATUS.CONFLICT
        : hasNew ? ITEM_STATUS.NEW : ITEM_STATUS.DUPLICATE;
    }

    if (draft.spa_profile) {
      const ex = existingProfiles?.spa?.data || {};
      const hasNew = Object.entries(draft.spa_profile).some(([k, v]) =>
        v && !ex[k]
      );
      out._spa_profile_status = hasNew ? ITEM_STATUS.NEW : ITEM_STATUS.DUPLICATE;
    }

    if (draft.sle_profile) {
      const ex = existingProfiles?.sle?.data || {};
      const hasNew = Object.entries(draft.sle_profile || {}).some(([k, v]) => {
        if (k === "antibodies") {
          return Object.keys(v || {}).some(ab => !(ex.antibodies || {})[ab]);
        }
        return v != null && ex[k] == null;
      });
      out._sle_profile_status = hasNew ? ITEM_STATUS.NEW : ITEM_STATUS.DUPLICATE;
    }

    if (draft.sclero_profile && existingSclero) {
      const sections = ["cutaneous", "antibody", "vascular", "ild", "pah", "gi", "msk"];
      const hasConflict = sections.some(sec => {
        const ex  = existingSclero[sec] || {};
        const drft = draft.sclero_profile[sec] || {};
        return Object.entries(drft).some(([k, v]) => ex[k] != null && ex[k] !== v);
      });
      const hasNew = sections.some(sec => {
        const ex  = existingSclero[sec] || {};
        const drft = draft.sclero_profile[sec] || {};
        return Object.entries(drft).some(([k, v]) => v != null && ex[k] == null);
      });
      out._sclero_profile_status = hasConflict
        ? ITEM_STATUS.CONFLICT
        : hasNew ? ITEM_STATUS.NEW : ITEM_STATUS.DUPLICATE;
    }

    return out;
  });
}

// ── Summary helpers used by the review UI ────────────────────────────────────

export function draftSummaryStats(draft) {
  const count = (arr, status) =>
    (arr || []).filter(x => (status ? x._status === status : true) && !x._skip_forced).length;

  const therapies    = draft.therapies    || [];
  const assessments  = draft.assessments  || [];
  const lab_exams    = draft.lab_exams    || [];
  const instrumental = draft.instrumental_findings || [];
  const raccordo     = draft.raccordo_events || [];

  const conflicts = [
    ...therapies.filter(x => x._status === ITEM_STATUS.CONFLICT),
    ...assessments.filter(x => x._status === ITEM_STATUS.CONFLICT),
  ].length;

  const toSave = [
    ...therapies.filter(x => !x._skip),
    ...assessments.filter(x => !x._skip),
    ...lab_exams.filter(x => !x._skip),
    ...instrumental.filter(x => !x._skip),
    ...raccordo.filter(x => !x._skip),
  ].length;

  const skipped = [
    ...therapies.filter(x => x._skip && x._status !== undefined),
    ...assessments.filter(x => x._skip && x._status !== undefined),
    ...lab_exams.filter(x => x._skip && x._status !== undefined),
    ...raccordo.filter(x => x._skip && x._status !== undefined),
  ].length;

  return { conflicts, toSave, skipped, therapies: therapies.length, assessments: assessments.length };
}
