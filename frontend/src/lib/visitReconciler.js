// ── Visit Reconciler ─────────────────────────────────────────────────────────
// Compares extracted multi-visit drafts against existing patient data and
// annotates each item with a status: new / duplicate / continuity / conflict /
// update / uncertain. Also deduplicates across letters within the same batch.

import { toCanonicalLabKey } from "./labValueExtractor";

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

export const LONGITUDINAL_FIELDS = [
  { key: "diagnosi",             label: "Diagnosi",                  mode: "single"  },
  { key: "allergie_testo",       label: "Allergie / Intolleranze",   mode: "append"  },
  { key: "anamnesi_familiare",   label: "Anamnesi familiare",        mode: "append"  },
  { key: "anamnesi_fisiologica", label: "Anamnesi fisiologica",      mode: "append"  },
  { key: "comorbidita_apr",      label: "Comorbidità / APR",         mode: "append"  },
  { key: "terapia_domiciliare",  label: "Terapia domiciliare",       mode: "replace" },
];

const PV_KEY_MAP = {
  "comorbidita_apr": "apr",
  "allergie_testo":  "allergie",
};

export const LONGIT_STATUS = {
  INVARIATO:  "invariato",
  NUOVO_DATO: "nuovo_dato",
  CONFLITTO:  "conflitto",
  MODIFICA:   "modifica",
};

export const LONGIT_STATUS_META = {
  invariato:  { label: "Invariato",     color: "gray",  dot: "#9ca3af", desc: "Già presente — nessuna azione" },
  nuovo_dato: { label: "Nuovo dato",    color: "teal",  dot: "#0d9488", desc: "Verrà aggiunto al profilo" },
  conflitto:  { label: "Conflitto",     color: "red",   dot: "#ef4444", desc: "Diverso dal valore attuale — richiede conferma" },
  modifica:   { label: "Aggiornamento", color: "amber", dot: "#f59e0b", desc: "Modifica rispetto al valore attuale — richiede conferma" },
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

function therapyYear(t) {
  const d = normDate(t.end_date || t.start_date || t.date);
  return d ? d.slice(0, 4) : "";
}

function startYear(t) {
  const d = normDate(t.start_date || t.date);
  return d ? d.slice(0, 4) : "";
}

function discIdentity(t) {
  return {
    key: normDrug(t.drug_name),
    year: therapyYear(t),
    reason: normTextSig(t.discontinuation_reason),
  };
}

function discMatch(a, b) {
  if (a.key !== b.key) return false;
  const yearOk = !a.year || !b.year || a.year === b.year;
  const reasonOk = !a.reason || !b.reason || a.reason === b.reason;
  return yearOk && reasonOk;
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

function instrKey(f) {
  const type = (f.exam_type || f.indexType || f.examType || f.type || "").toLowerCase().trim();
  const date = normDate(f.date || f.exam_date || "");
  const terr = (f.territory || "").toLowerCase().trim();
  return `${type}::${date}::${terr}`;
}

function buildInstrumentalSet(exams) {
  const set = new Set();
  for (const e of exams || []) {
    const k = instrKey(e);
    if (k !== "::" ) set.add(k);
  }
  return set;
}

function normLabValue(v) {
  if (v === null || v === undefined) return "";
  return String(v).toLowerCase().replace(/\s+/g, "").replace(",", ".");
}

function labValSig(entry) {
  const val  = normLabValue(entry?.value);
  const unit = normLabValue(entry?.unit);
  const qual = normLabValue(entry?.qualitative);
  return `${val}|${unit}|${qual}`;
}

function labParamKey(date, paramKey) {
  return `${normDate(date)}::${paramKey}`;
}

function buildLabValueMap(labs) {
  const map = new Map();
  for (const l of labs || []) {
    const values = l.values || {};
    for (const [pk, entry] of Object.entries(values)) {
      if (!entry) continue;
      map.set(labParamKey(l.date, pk), labValSig(entry));
    }
  }
  return map;
}

function normTextSig(s) {
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
}

// ── Longitudinal field comparison ─────────────────────────────────────────────

function extractDraftLongitudinalField(draft, key) {
  const pg = draft.profilo_generale || {};
  const pp = draft.patient || {};
  switch (key) {
    case "diagnosi":             return pg.diagnosi || pp.diagnosi || null;
    case "allergie_testo":       return pg.allergie || null;
    case "anamnesi_familiare":   return pg.anamnesi_familiare || null;
    case "anamnesi_fisiologica": return pg.anamnesi_fisiologica || null;
    case "comorbidita_apr":      return pg.comorbidita_apr || null;
    case "terapia_domiciliare":  return pg.terapia_domiciliare || null;
    default:                     return null;
  }
}

function longitudinalFieldStatus(key, mode, previous, current) {
  if (!current) return null;
  const normPrev = normTextSig(previous || "");
  const normCurr = normTextSig(current || "");
  if (!normPrev) return LONGIT_STATUS.NUOVO_DATO;
  if (normPrev === normCurr) return LONGIT_STATUS.INVARIATO;

  if (mode === "single") return LONGIT_STATUS.CONFLITTO;
  if (mode === "replace") return LONGIT_STATUS.MODIFICA;

  // mode === "append": check if current adds something genuinely new
  const currWords = normCurr.split(" ").filter(Boolean);
  const prevWords = new Set(normPrev.split(" ").filter(Boolean));
  if (currWords.every(w => prevWords.has(w))) return LONGIT_STATUS.INVARIATO;

  const overlap = currWords.filter(w => prevWords.has(w)).length;
  const overlapRatio = currWords.length > 0 ? overlap / currWords.length : 0;
  return overlapRatio >= 0.4 ? LONGIT_STATUS.NUOVO_DATO : LONGIT_STATUS.CONFLITTO;
}

export function diffLongitudinalFields(draft, existingPatient, primaVisita = null) {
  if (!existingPatient) return [];
  const pvData = primaVisita?.data || {};
  const result = [];
  for (const { key, label, mode } of LONGITUDINAL_FIELDS) {
    const current  = extractDraftLongitudinalField(draft, key);
    const pvKey    = PV_KEY_MAP[key] || key;
    const previous = existingPatient[key] || pvData[pvKey] || null;
    if (process.env.NODE_ENV !== "production") {
      console.log("[Reconciler][longitudinal]", key, "previous:", previous, "| patient root:", existingPatient[key] ?? null, "| prima_visita.data." + pvKey + ":", pvData[pvKey] ?? null);
    }
    const status   = longitudinalFieldStatus(key, mode, previous, current);
    if (!status) continue;
    const _skip = status === LONGIT_STATUS.NUOVO_DATO
      ? null
      : !!(status === LONGIT_STATUS.INVARIATO ||
           status === LONGIT_STATUS.CONFLITTO  ||
           status === LONGIT_STATUS.MODIFICA);
    result.push({ key, label, mode, previous, current, status, _skip });
  }
  return result;
}

function eventDateKey(e) {
  const raw = (e.date_value || e.date_estimated || "").toString();
  if (e.date_precision === "year" || raw.length === 4) return raw.slice(0, 4);
  return normDate(raw);
}

const EVENT_TYPES_NO_TEXT_SIG = new Set(["diagnosis", "disease_status"]);

function eventKey(e) {
  const drug = e.drug_canonical || e.to_drug || e.from_drug || "";
  const text = EVENT_TYPES_NO_TEXT_SIG.has(e.event_type)
    ? ""
    : normTextSig(e.manifestation || e.detail);
  return `${e.event_type || ""}::${eventDateKey(e)}::${normTextSig(drug)}::${text}`;
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
    therapies:          existingTherapies    = [],
    assessments:        existingAssessments  = [],
    lab_exams:          existingLabs         = [],
    instrumental_exams: existingInstrumental = [],
    disease_profiles:   existingProfiles     = {},
    sclero_profile:     existingSclero       = null,
    clinical_events:    existingEvents       = [],
  } = existingData;

  const therapyMap      = buildTherapyMap(existingTherapies);
  const assessmentSet   = buildAssessmentSet(existingAssessments);
  const instrumentalSet = buildInstrumentalSet(existingInstrumental);
  const labValueMap     = buildLabValueMap(existingLabs);
  const eventSet        = buildEventSet(existingEvents);

  // Cross-draft deduplication trackers (shared across all drafts)
  const seenDrugs         = new Set();
  const seenAssessments   = new Set();
  const seenLabValues     = new Map();
  const seenEvents        = new Set();
  const seenInstrumental  = new Set();
  const seenActiveDrugs   = new Set();
  const seenDisc          = new Map();
  const activeStartYear   = new Map();
  const seenActiveDoseMap = new Map();

  const recordSchedule = (t, key) => {
    seenDrugs.add(key);
    if (t.status === "discontinued") {
      const id = discIdentity(t);
      const list = seenDisc.get(id.key) || [];
      list.push(id);
      seenDisc.set(id.key, list);
    } else {
      seenActiveDrugs.add(key);
      const y = startYear(t);
      if (y) activeStartYear.set(key, y);
      seenActiveDoseMap.set(key, t.dose || null);
    }
  };

  const isDiscDuplicate = (t) => {
    const id = discIdentity(t);
    return (seenDisc.get(id.key) || []).some(p => discMatch(p, id));
  };

  return drafts.map((draft, draftIdx) => {
    const out = { ...draft };

    // ── Therapies ───────────────────────────────────────────────────────────
    if (Array.isArray(draft.therapies)) {
      out.therapies = draft.therapies.map(t => {
        const key = normDrug(t.drug_name);
        if (!key) return { ...t, _status: ITEM_STATUS.UNCERTAIN, _statusReason: "Nome farmaco non riconoscibile" };

        const existing = therapyMap.get(key);

        if (seenDrugs.has(key)) {
          if (t.status === "discontinued") {
            if (isDiscDuplicate(t)) {
              return {
                ...t,
                _status: ITEM_STATUS.DUPLICATE,
                _statusReason: "Sospensione già registrata in un'altra lettera del batch",
                _skip: true,
              };
            }
            if (seenActiveDrugs.has(key)) {
              const dy = therapyYear(t);
              const ay = activeStartYear.get(key);
              if (dy && ay && dy < ay) {
                recordSchedule(t, key);
                return {
                  ...t,
                  _status: ITEM_STATUS.NEW,
                  _statusReason: "Esposizione storica precedente all'episodio attivo",
                  _action: "new_episode",
                };
              }
              recordSchedule(t, key);
              return {
                ...t,
                _status: ITEM_STATUS.UPDATE,
                _statusReason: `Lettera precedente la registra attiva — questa segnala sospensione${t.discontinuation_reason ? `: ${t.discontinuation_reason}` : ""}`,
                _skip: false,
                _action: "discontinue",
              };
            }
            recordSchedule(t, key);
            return {
              ...t,
              _status: ITEM_STATUS.NEW,
              _statusReason: "Sospensione pregressa distinta (farmaco, motivo o data diversi)",
              _action: "new_episode",
            };
          }
          // ── Dose change vs lettera precedente del batch ───────────────
          if (seenActiveDoseMap.has(key)) {
            const prevDose = seenActiveDoseMap.get(key);
            const prevMg   = normDoseMg(prevDose);
            const newMg    = normDoseMg(t.dose);
            if (prevMg !== null && newMg !== null && prevMg !== newMg) {
              recordSchedule(t, key);
              return {
                ...t,
                _status: ITEM_STATUS.CONFLICT,
                _statusReason: `Cambio dose rispetto alla lettera precedente: ${prevDose} → ${t.dose}`,
                _skip: false,
                _action: "dose_change",
                _dose_before: prevDose,
              };
            }
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
              const dy = therapyYear(t);
              const ay = startYear(existing);
              if (dy && ay && dy < ay) {
                recordSchedule(t, key);
                return {
                  ...t,
                  _status: ITEM_STATUS.NEW,
                  _statusReason: "Esposizione storica precedente all'episodio attivo in DB",
                  _action: "new_episode",
                };
              }
              recordSchedule(t, key);
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
              recordSchedule(t, key);
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
              recordSchedule(t, key);
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
            recordSchedule(t, key);
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
              // Se la lettera è anteriore alla data di sospensione in DB, non è un
              // riavvio: la terapia era semplicemente ancora attiva all'epoca della
              // lettera e verrà poi sospesa. Saltiamo silenziosamente.
              const letterDate = (draft.visit_date || "").slice(0, 10);
              const stopDate   = (existing.end_date  || "").slice(0, 10);
              if (letterDate && stopDate && letterDate < stopDate) {
                recordSchedule(t, key);
                return {
                  ...t,
                  _status: ITEM_STATUS.CONTINUITY,
                  _statusReason: `Attiva alla data della lettera (${letterDate}), poi sospesa in DB (${stopDate}) — non è un riavvio`,
                  _skip: true,
                  _action: "continued",
                };
              }
              recordSchedule(t, key);
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

        recordSchedule(t, key);
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
    // Conflitto a livello di singolo parametro: stesso param_key + stessa data
    // con valore/unità discordante => CONFLICT (mai sovrascritto). Identico =>
    // duplicate. Almeno un parametro nuovo => l'esame si salva (i risultati
    // duplicati/in conflitto sono marcati _skip a livello di risultato e il
    // builder li filtra prima dell'upsert, quindi non toccano il dato esistente).
    if (Array.isArray(draft.lab_exams)) {
      out.lab_exams = draft.lab_exams.map(l => {
        const results = Array.isArray(l.results) ? l.results : [];
        let anyNew = false;
        let anyConflict = false;
        let anyDuplicate = false;

        const annotatedResults = results.map(r => {
          const pk  = r.param_key || toCanonicalLabKey(r.name);
          if (!pk) return { ...r };
          const key = labParamKey(l.date, pk);
          const sig = labValSig({ value: r.value, unit: r.unit, qualitative: r.qualitative });

          const existingSig = labValueMap.has(key) ? labValueMap.get(key)
            : (seenLabValues.has(key) ? seenLabValues.get(key) : undefined);

          if (existingSig !== undefined) {
            if (existingSig === sig) {
              anyDuplicate = true;
              return { ...r, _status: ITEM_STATUS.DUPLICATE, _statusReason: "Valore già presente per questa data", _skip: true };
            }
            anyConflict = true;
            return { ...r, _status: ITEM_STATUS.CONFLICT, _statusReason: "Valore discordante per stesso parametro e data", _skip: true };
          }

          seenLabValues.set(key, sig);
          anyNew = true;
          return { ...r, _status: ITEM_STATUS.NEW };
        });

        let status = ITEM_STATUS.DUPLICATE;
        let reason = "Tutti i valori già presenti per questa data";
        if (anyConflict) {
          status = ITEM_STATUS.CONFLICT;
          reason = anyNew ? "Alcuni valori discordanti per stesso parametro e data" : "Valori discordanti per stesso parametro e data";
        } else if (anyNew) {
          status = ITEM_STATUS.NEW;
          reason = anyDuplicate ? "Alcuni nuovi valori per questa data" : null;
        }

        return { ...l, results: annotatedResults, _status: status, _statusReason: reason, _skip: !anyNew };
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

    // ── Instrumental findings (esami strumentali e imaging in visione) ───────
    // Dedup su exam_type + date + territory vs DB e vs altri draft del batch.
    for (const arrayKey of ["instrumental_findings", "exam_imaging"]) {
      if (Array.isArray(draft[arrayKey])) {
        out[arrayKey] = draft[arrayKey].map(f => {
          const key = instrKey(f);
          if (instrumentalSet.has(key)) {
            return { ...f, _status: ITEM_STATUS.DUPLICATE, _statusReason: "Già presente in archivio per questa data e tipo", _skip: true };
          }
          if (seenInstrumental.has(key)) {
            return { ...f, _status: ITEM_STATUS.DUPLICATE, _statusReason: "Duplicato in un'altra lettera del batch", _skip: true };
          }
          seenInstrumental.add(key);
          return { ...f, _status: ITEM_STATUS.NEW };
        });
      }
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

    if (existingData.patient) {
      out._longitudinal = diffLongitudinalFields(draft, existingData.patient, existingData.prima_visita || null);
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

  const labResultConflicts = lab_exams.reduce(
    (s, ex) => s + (ex.results || []).filter(r => r._status === ITEM_STATUS.CONFLICT).length,
    0
  );

  const conflicts = [
    ...therapies.filter(x => x._status === ITEM_STATUS.CONFLICT),
    ...assessments.filter(x => x._status === ITEM_STATUS.CONFLICT),
  ].length + labResultConflicts;

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
