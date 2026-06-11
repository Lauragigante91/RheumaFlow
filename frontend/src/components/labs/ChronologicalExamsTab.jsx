/**
 * ChronologicalExamsTab
 *
 * Vista cronologica unificata: Lab + Strumentali + Visite specialistiche
 * ordinati dalla più recente alla più vecchia.
 * Filtri rapidi per tipo di fonte.
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { labExamsApi, instrumentalExamsApi, specialistVisitsApi } from "../../lib/api";
import { FlaskConical, ScanSearch, Stethoscope, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { LAB_PANELS } from "../../lib/labPanels";
import { SPECIALTIES } from "../specialist/SpecialistVisitsSection";

// ─── Panel label lookup ───────────────────────────────────────────────────────
const PANEL_LABEL = Object.fromEntries(
  Object.entries(LAB_PANELS).map(([k, v]) => [k, v.label])
);
PANEL_LABEL.custom = "Personalizzato";

// Key → panel key lookup (for deriving title from values dict)
const KEY_TO_PANEL = {};
for (const [pKey, p] of Object.entries(LAB_PANELS)) {
  for (const t of p.tests) KEY_TO_PANEL[t.key] = pKey;
}

function labTitle(exam) {
  if (exam.panel && exam.panel !== "combined" && PANEL_LABEL[exam.panel]) {
    return PANEL_LABEL[exam.panel];
  }
  const keys = Object.keys(exam.values || {});
  if (!keys.length) return "Laboratorio";
  const seen = new Set();
  const panels = [];
  for (const k of keys) {
    const pKey = KEY_TO_PANEL[k];
    if (pKey && !seen.has(pKey)) { seen.add(pKey); panels.push(PANEL_LABEL[pKey]); }
  }
  if (!panels.length) return exam.panel || "Laboratorio";
  if (panels.length <= 3) return panels.join(" · ");
  return `${panels.slice(0, 2).join(" · ")} +${panels.length - 2}`;
}

// ─── Instrumental exam type metadata (sync with InstrumentalExamsSection) ────
const EXAM_META = {
  petvas:        { label: "PET/TC",                color: "#be185d", bg: "#fff1f2" },
  ecodoppler:    { label: "Eco Doppler vascolare",  color: "#1d4ed8", bg: "#eff6ff" },
  angio_ct:      { label: "AngioCT",                color: "#b45309", bg: "#fffbeb" },
  angio_mri:     { label: "AngioMRI",               color: "#7c3aed", bg: "#f5f3ff" },
  echo_msk:      { label: "Eco MSK",                color: "#0f766e", bg: "#f0fdfa" },
  echo_cardiac:  { label: "Ecocardiografia",        color: "#dc2626", bg: "#fef2f2" },
  hrct:          { label: "HRCT / TC torace",       color: "#0284c7", bg: "#f0f9ff" },
  pft:           { label: "Spirometria / PFR",      color: "#0891b2", bg: "#ecfeff" },
  capillaroscopy:{ label: "Capillaroscopia (NVC)",  color: "#7c3aed", bg: "#faf5ff" },
  xray:          { label: "Radiografia",            color: "#374151", bg: "#f9fafb" },
  mri:           { label: "RM",                     color: "#9333ea", bg: "#faf5ff" },
  ct:            { label: "TC",                     color: "#9a3412", bg: "#fff7ed" },
  other:         { label: "Altro strumentale",      color: "#6b7280", bg: "#f9fafb" },
};

const SPECIALTY_MAP = Object.fromEntries(SPECIALTIES.map(s => [s.key, s]));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function labSummary(exam) {
  const values = exam.values || {};
  const keys = Object.keys(values);
  if (keys.length === 0) return "Nessun valore registrato";
  const chips = keys.slice(0, 5).map(k => {
    const v = values[k];
    if (v.value != null) return `${k.toUpperCase()} ${v.value}${v.unit ? " " + v.unit : ""}`;
    if (v.qualitative) return `${k.toUpperCase()}: ${v.qualitative}`;
    return k.toUpperCase();
  });
  const more = keys.length > 5 ? ` +${keys.length - 5}` : "";
  return chips.join(" · ") + more;
}

// ─── Single event row ─────────────────────────────────────────────────────────
function EventRow({ event }) {
  const [open, setOpen] = useState(false);

  const labelStyle = {
    display: "inline-flex", alignItems: "center", gap: "4px",
    padding: "2px 8px", borderRadius: "20px",
    fontSize: "11px", fontWeight: 600,
    color: event.color, background: event.bg,
    border: `1px solid ${event.color}22`,
    flexShrink: 0,
  };

  return (
    <div style={{
      borderBottom: "1px solid #f3f4f6",
      padding: "10px 4px",
      cursor: event.detail ? "pointer" : "default",
    }}
      onClick={() => event.detail && setOpen(o => !o)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        {/* Date */}
        <div style={{
          fontSize: "12px", fontWeight: 600, color: "#374151",
          minWidth: "88px", paddingTop: "2px", flexShrink: 0,
        }}>
          {fmtDate(event.date)}
        </div>

        {/* Type badge */}
        <div style={labelStyle}>
          <event.Icon size={11} />
          {event.typeLabel}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827", marginBottom: "2px" }}>
            {event.title}
          </div>
          {event.summary && (
            <div style={{
              fontSize: "12px", color: "#6b7280",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {event.summary}
            </div>
          )}
        </div>

        {/* Expand toggle */}
        {event.detail && (
          <div style={{ color: "#9ca3af", paddingTop: "2px", flexShrink: 0 }}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {open && event.detail && (
        <div style={{
          marginTop: "8px", marginLeft: "100px",
          fontSize: "12px", color: "#374151",
          background: "#f9fafb", borderRadius: "6px",
          padding: "10px 12px", whiteSpace: "pre-wrap", lineHeight: "1.5",
        }}>
          {event.detail}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChronologicalExamsTab({ patient }) {
  const [labExams,          setLabExams]          = useState([]);
  const [instrumentalExams, setInstrumentalExams] = useState([]);
  const [specVisits,        setSpecVisits]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("all"); // "all"|"lab"|"strumentali"|"specialist"

  const load = useCallback(async () => {
    if (!patient?.id) return;
    setLoading(true);
    try {
      const [labs, instrs, visits] = await Promise.all([
        labExamsApi.listByPatient(patient.id),
        instrumentalExamsApi.list(patient.id),
        specialistVisitsApi.listByPatient(patient.id),
      ]);
      setLabExams(labs);
      setInstrumentalExams(instrs);
      setSpecVisits(visits);
    } catch (_) {
      // ignore — show empty state
    } finally {
      setLoading(false);
    }
  }, [patient?.id]);

  useEffect(() => { load(); }, [load]);

  // ── Build unified event list ────────────────────────────────────────────────
  const events = useMemo(() => {
    const list = [];

    // Lab exams
    for (const ex of labExams) {
      const valCount = Object.keys(ex.values || {}).length;
      list.push({
        id:        `lab-${ex.id}`,
        date:      ex.date,
        source:    "lab",
        typeLabel: "Laboratorio",
        Icon:      FlaskConical,
        color:     "#0f766e",
        bg:        "#f0fdfa",
        title:     labTitle(ex),
        summary:   labSummary(ex),
        detail:    ex.notes || null,
        _count:    valCount,
      });
    }

    // Instrumental exams
    for (const a of instrumentalExams) {
      const examTypeKey = a.exam_type || "other";
      const meta = EXAM_META[examTypeKey] || EXAM_META.other;
      list.push({
        id:        `instr-${a.id}`,
        date:      a.exam_date,
        source:    "strumentali",
        typeLabel: "Strumentale",
        Icon:      ScanSearch,
        color:     meta.color,
        bg:        meta.bg,
        title:     meta.label,
        summary:   a.summary || "",
        detail:    a.source_text || null,
      });
    }

    // Specialist visits
    for (const v of specVisits) {
      const sp       = SPECIALTY_MAP[v.specialty] || SPECIALTY_MAP["altra"];
      const title    = v.visit_type || sp.label;
      const summary  = v.notes || "";
      const detail   = v.source_text || null;
      list.push({
        id:        `spec-${v.id}`,
        date:      v.visit_date,
        source:    "specialist",
        typeLabel: "Visita spec.",
        Icon:      Stethoscope,
        color:     sp.color,
        bg:        sp.bg,
        title,
        summary,
        detail,
      });
    }

    // Sort newest first; esami senza data in fondo
    list.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });
    return list;
  }, [labExams, instrumentalExams, specVisits]);

  const filtered = filter === "all" ? events : events.filter(e => e.source === filter);

  // ── Filter counts ──────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:          events.length,
    lab:          events.filter(e => e.source === "lab").length,
    strumentali:  events.filter(e => e.source === "strumentali").length,
    specialist:   events.filter(e => e.source === "specialist").length,
  }), [events]);

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40px", color: "#9ca3af" }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const FILTERS = [
    { key: "all",         label: "Tutti" },
    { key: "lab",         label: "Lab" },
    { key: "strumentali", label: "Strumentali" },
    { key: "specialist",  label: "Visite spec." },
  ];

  return (
    <div>
      {/* ── Filter pills ── */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                padding: "4px 12px", borderRadius: "20px",
                border: active ? "none" : "1px solid #e5e7eb",
                background: active ? "#0A2540" : "#fff",
                color: active ? "#fff" : "#374151",
                fontSize: "12px", fontWeight: active ? 600 : 500,
                cursor: "pointer",
              }}
            >
              {f.label}
              <span style={{
                marginLeft: "5px",
                background: active ? "rgba(255,255,255,0.25)" : "#f3f4f6",
                color: active ? "#fff" : "#6b7280",
                padding: "0 6px", borderRadius: "10px", fontSize: "11px",
              }}>
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Timeline ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af", fontSize: "13px" }}>
          Nessun esame registrato
        </div>
      ) : (
        <div>
          {filtered.map(event => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
