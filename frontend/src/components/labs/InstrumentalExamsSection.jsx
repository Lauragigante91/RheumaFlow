/**
 * InstrumentalExamsSection
 *
 * Archive of instrumental findings stored as assessments
 * (index_type: petvas | ecodoppler | angio_ct | angio_mri | echo_msk | imaging_report).
 *
 * Two views: by exam type / by date.
 * Sort order: newest first / oldest first.
 *
 * Props:
 *   patient — full patient object
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { instrumentalExamsApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Plus, Trash2, ChevronDown, ChevronRight, CalendarDays, LayoutList,
  ArrowUpDown, Zap, Activity, Layers, Radio, Scan, Film, Cpu, FileImage,
  HelpCircle, Heart, Wind, BarChart2, Microscope, FileText, Dna,
} from "lucide-react";
import { toast } from "sonner";
import InstrumentalFindingModal, { getProfileMapping } from "./InstrumentalFindingModal";
import FindingProfileUpdateModal from "../profiles/FindingProfileUpdateModal";

// ─── Exam type metadata (mirrors InstrumentalFindingModal's EXAM_TYPES) ───────
const EXAM_META = {
  petvas:        { label: "PET/TC",               color: "#be185d", bg: "#fff1f2", icon: Zap },
  ecodoppler:    { label: "Eco Doppler vascolare", color: "#1d4ed8", bg: "#eff6ff", icon: Activity },
  angio_ct:      { label: "AngioCT (CTA)",         color: "#b45309", bg: "#fffbeb", icon: Layers },
  angio_mri:     { label: "AngioMRI (MRA)",        color: "#7c3aed", bg: "#f5f3ff", icon: Radio },
  echo_msk:      { label: "Eco MSK / articolare",  color: "#0f766e", bg: "#f0fdfa", icon: Scan },
  echo_cardiac:  { label: "Ecocardiografia",       color: "#dc2626", bg: "#fef2f2", icon: Heart },
  hrct:          { label: "HRCT / TC torace",      color: "#0284c7", bg: "#f0f9ff", icon: Wind },
  pft:           { label: "Spirometria / PFR",     color: "#0891b2", bg: "#ecfeff", icon: BarChart2 },
  capillaroscopy:{ label: "Capillaroscopia (NVC)", color: "#7c3aed", bg: "#faf5ff", icon: Microscope },
  xray:          { label: "Radiografia",           color: "#374151", bg: "#f9fafb", icon: Film },
  mri:           { label: "RM",                    color: "#9333ea", bg: "#faf5ff", icon: Cpu },
  ct:            { label: "TC",                    color: "#9a3412", bg: "#fff7ed", icon: FileImage },
  other:         { label: "Altro strumentale",     color: "#6b7280", bg: "#f9fafb", icon: HelpCircle },
};

// Ordered list of exam type keys for "per tipo" view
const EXAM_TYPE_KEYS = Object.keys(EXAM_META);

const RESULT_BADGE = {
  positive: { label: "Positivo", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  negative: { label: "Negativo", color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  doubtful: { label: "Dubbio",   color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Single finding card ──────────────────────────────────────────────────────
function FindingCard({ assessment: exam, onRemove, onUpdateProfile, patient, showTypeHeader = false }) {
  const [srcOpen, setSrcOpen] = useState(false);

  const examTypeKey       = exam.exam_type || "other";
  const hasProfileMapping = !!getProfileMapping(examTypeKey, patient);
  const meta = EXAM_META[examTypeKey] || EXAM_META.other;
  const Icon = meta.icon;
  const result = exam.result;
  const resultMeta = result ? RESULT_BADGE[result] : null;
  const sv = exam.structured_values || {};
  const hasSv = Object.keys(sv).length > 0;
  const sourceText = exam.source_text || "";

  return (
    <div style={{
      padding: "12px 14px",
      borderBottom: "1px solid #f3f4f6",
      display: "flex", flexDirection: "column", gap: "6px",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {showTypeHeader && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              padding: "2px 8px", borderRadius: "999px", fontSize: "10px",
              fontWeight: 700, background: meta.bg, color: meta.color,
              border: `1px solid ${meta.color}33`,
            }}>
              <Icon size={10} /> {meta.label}
            </span>
          )}
          <span style={{ fontWeight: 600, fontSize: "13px", color: "#0A2540" }}>{fmtDate(exam.exam_date)}</span>
          {resultMeta && (
            <span style={{
              padding: "2px 9px", borderRadius: "999px", fontSize: "11px",
              fontWeight: 700, background: resultMeta.bg, color: resultMeta.color,
              border: `1.5px solid ${resultMeta.border}`,
            }}>
              {resultMeta.label}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {/* → Profilo malattia */}
          {hasProfileMapping && onUpdateProfile && (
            <button
              type="button"
              onClick={() => onUpdateProfile(exam)}
              title="Aggiorna profilo malattia da questo referto"
              style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "3px 8px", borderRadius: "6px",
                border: "1px solid #bfdbfe",
                background: "#eff6ff", color: "#1d4ed8",
                fontSize: "10px", fontWeight: 700, cursor: "pointer",
                transition: "all 0.1s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#dbeafe"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#eff6ff"; }}
            >
              <Dna size={11} />
              → Profilo
            </button>
          )}
          {/* Testo originale */}
          {sourceText && (
            <button
              type="button"
              onClick={() => setSrcOpen(v => !v)}
              title={srcOpen ? "Nascondi testo originale" : "Mostra testo originale"}
              style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "3px 8px", borderRadius: "6px", border: "1px solid #e5e7eb",
                background: srcOpen ? "#f0f9ff" : "#f9fafb",
                color: srcOpen ? "#0284c7" : "#6b7280",
                fontSize: "10px", fontWeight: 600, cursor: "pointer",
                transition: "all 0.1s",
              }}
              onMouseEnter={e => { if (!srcOpen) e.currentTarget.style.background = "#f3f4f6"; }}
              onMouseLeave={e => { if (!srcOpen) e.currentTarget.style.background = "#f9fafb"; }}
            >
              <FileText size={11} />
              Testo
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(exam)}
          >
            <Trash2 size={14} style={{ color: "#ef4444" }} />
          </Button>
        </div>
      </div>

      {/* Summary */}
      {exam.summary && (
        <p style={{ fontSize: "12px", color: "#374151", lineHeight: 1.5, margin: 0 }}>
          {exam.summary}
        </p>
      )}

      {/* Territory chip */}
      {exam.territory && (
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          <span style={{
            fontSize: "10px", padding: "2px 7px", borderRadius: "999px",
            background: "#f3f4f6", color: "#374151", fontWeight: 500,
          }}>
            📍 {exam.territory}
          </span>
        </div>
      )}

      {/* Structured values */}
      {hasSv && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "2px" }}>
          {Object.entries(sv).map(([k, v]) => {
            if (v === null || v === undefined || v === "") return null;
            const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
            return (
              <span key={k} style={{
                display: "inline-flex", alignItems: "center", gap: "3px",
                padding: "2px 7px", borderRadius: "999px", fontSize: "10px",
                background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33`,
                fontWeight: 600,
              }}>
                <span style={{ fontWeight: 400, color: "#6b7280" }}>{label}:</span>
                <span style={{ fontFamily: "monospace" }}>{String(v)}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Source text — expandable */}
      {srcOpen && sourceText && (
        <div style={{
          marginTop: "4px",
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: "6px",
          padding: "8px 10px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "5px",
            fontSize: "9px", fontWeight: 700, color: "#0284c7",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "5px",
          }}>
            <FileText size={10} />
            Testo originale selezionato
          </div>
          <p style={{
            fontSize: "11px", color: "#0c4a6e",
            fontFamily: "monospace", lineHeight: "1.7",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            margin: 0,
          }}>
            {sourceText}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── "Per tipo" view: one collapsible block per exam type ─────────────────────
function ByTypeView({ findings, onRemove, onUpdateProfile, patient }) {
  const [expanded, setExpanded] = useState({});

  const byType = useMemo(() => {
    const m = {};
    findings.forEach(a => {
      const k = a.exam_type || "other";
      if (!m[k]) m[k] = [];
      m[k].push(a);
    });
    return m;
  }, [findings]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {EXAM_TYPE_KEYS.map(key => {
        const group = byType[key];
        if (!group || group.length === 0) return null;
        const meta = EXAM_META[key] || EXAM_META.other;
        const Icon = meta.icon;
        const isOpen = expanded[key] !== false;
        return (
          <Card key={key} style={{ border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <button
              type="button"
              onClick={() => setExpanded(p => ({ ...p, [key]: !isOpen }))}
              style={{
                width: "100%", textAlign: "left", padding: "10px 14px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "none", border: "none", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {isOpen ? <ChevronDown size={15} color="#6b7280" /> : <ChevronRight size={15} color="#6b7280" />}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  background: meta.bg, color: meta.color, padding: "3px 10px",
                  borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                  border: `1px solid ${meta.color}33`,
                }}>
                  <Icon size={11} /> {meta.label}
                </span>
                <Badge variant="outline" style={{ fontSize: "10px" }}>{group.length} referti</Badge>
              </div>
            </button>
            {isOpen && (
              <div style={{ borderTop: "1px solid #f3f4f6" }}>
                {group.map(a => (
                  <FindingCard key={a.id} assessment={a} onRemove={onRemove} onUpdateProfile={onUpdateProfile} patient={patient} showTypeHeader={false} />
                ))}
              </div>
            )}
          </Card>
        );
      })}
      {/* Unknown types */}
      {Object.entries(byType)
        .filter(([k]) => !EXAM_META[k])
        .map(([k, group]) => (
          group.map(a => (
            <FindingCard key={a.id} assessment={a} onRemove={onRemove} onUpdateProfile={onUpdateProfile} patient={patient} showTypeHeader={true} />
          ))
        ))
      }
    </div>
  );
}

// ─── "Per data" view: one collapsible block per date ─────────────────────────
function ByDateView({ findings, onRemove, onUpdateProfile, patient }) {
  const [expanded, setExpanded] = useState({});

  const byDate = useMemo(() => {
    const m = {};
    findings.forEach(a => {
      const d = a.exam_date || "9999";
      if (!m[d]) m[d] = [];
      m[d].push(a);
    });
    return Object.entries(m); // already sorted by parent
  }, [findings]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {byDate.map(([date, group]) => {
        const isOpen = expanded[date] !== false;
        const total = group.length;
        return (
          <Card key={date} style={{ border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <button
              type="button"
              onClick={() => setExpanded(p => ({ ...p, [date]: !isOpen }))}
              style={{
                width: "100%", textAlign: "left", padding: "10px 14px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "none", border: "none", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {isOpen ? <ChevronDown size={15} color="#6b7280" /> : <ChevronRight size={15} color="#6b7280" />}
                <CalendarDays size={15} color="#0A2540" />
                <span style={{ fontWeight: 700, fontSize: "14px", color: "#0A2540" }}>{fmtDate(date)}</span>
                <Badge variant="outline" style={{ fontSize: "10px" }}>{total} {total === 1 ? "referto" : "referti"}</Badge>
              </div>
            </button>
            {isOpen && (
              <div style={{ borderTop: "1px solid #f3f4f6" }}>
                {group.map(a => (
                  <FindingCard key={a.id} assessment={a} onRemove={onRemove} onUpdateProfile={onUpdateProfile} patient={patient} showTypeHeader={true} />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function InstrumentalExamsSection({ patient }) {
  const [allAssessments, setAllAssessments] = useState([]);
  const [addModalOpen,   setAddModalOpen]   = useState(false);
  const [viewMode,       setViewMode]       = useState("tipo");   // "tipo" | "data"
  const [sortOrder,      setSortOrder]      = useState("desc");   // "desc" | "asc"
  const [profileModal,   setProfileModal]   = useState({ open: false, assessment: null });

  const openProfileModal = useCallback((assessment) => {
    setProfileModal({ open: true, assessment });
  }, []);

  const load = useCallback(async () => {
    if (!patient?.id) return;
    try {
      const data = await instrumentalExamsApi.list(patient.id);
      setAllAssessments(data);
    } catch {
      toast.error("Errore nel caricamento degli esami strumentali");
    }
  }, [patient?.id]);

  useEffect(() => { load(); }, [load]);

  // Filter to instrumental findings only
  const findings = useMemo(() => {
    return [...allAssessments]
      .sort((a, b) => sortOrder === "desc"
        ? (b.exam_date || "").localeCompare(a.exam_date || "")
        : (a.exam_date || "").localeCompare(b.exam_date || ""))
  }, [allAssessments, sortOrder]);

  const remove = useCallback(async (a) => {
    if (!window.confirm("Eliminare questo referto strumentale?")) return;
    try {
      await instrumentalExamsApi.remove(a.id);
      toast.success("Referto eliminato");
      load();
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <h2 className="font-heading font-bold text-xl tracking-tight">
          Esami strumentali
          {findings.length > 0 && (
            <span style={{ fontWeight: 400, fontSize: "13px", color: "#9ca3af", marginLeft: "8px" }}>
              ({findings.length} referti)
            </span>
          )}
        </h2>
        <Button
          onClick={() => setAddModalOpen(true)}
          className="bg-[#0A2540] text-white hover:bg-[#051626]"
        >
          <Plus className="w-4 h-4 mr-2" /> Aggiungi referto
        </Button>
      </div>

      {findings.length === 0 ? (
        <Card className="border-gray-200 shadow-sm p-10 text-center text-gray-500 text-sm">
          Nessun esame strumentale registrato.
          <br />
          Clicca "Aggiungi referto" o usa la selezione testo nelle note visita.
        </Card>
      ) : (
        <>
          {/* ── View / sort controls ── */}
          <div style={{
            display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
            background: "#f9fafb", borderRadius: "8px", padding: "8px 12px",
          }}>
            <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>Visualizza per:</span>

            <div style={{ display: "flex", background: "#e5e7eb", borderRadius: "6px", padding: "2px" }}>
              {[
                { key: "tipo", label: "Tipo esame", icon: LayoutList },
                { key: "data", label: "Data",       icon: CalendarDays },
              ].map(({ key, label, icon: Ic }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewMode(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "4px 10px", borderRadius: "4px", border: "none", cursor: "pointer",
                    fontSize: "12px", fontWeight: 600,
                    background: viewMode === key ? "#fff" : "transparent",
                    color: viewMode === key ? "#0A2540" : "#6b7280",
                    boxShadow: viewMode === key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.1s",
                  }}
                >
                  <Ic size={13} /> {label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            <button
              type="button"
              onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "4px 10px", borderRadius: "6px",
                border: "1px solid #d1d5db", background: "#fff",
                cursor: "pointer", fontSize: "12px", color: "#374151", fontWeight: 500,
              }}
            >
              <ArrowUpDown size={13} />
              {sortOrder === "desc" ? "Più recenti prima" : "Più vecchi prima"}
            </button>
          </div>

          {/* ── List views ── */}
          {viewMode === "tipo" && (
            <ByTypeView findings={findings} onRemove={remove} onUpdateProfile={openProfileModal} patient={patient} />
          )}
          {viewMode === "data" && (
            <ByDateView findings={findings} onRemove={remove} onUpdateProfile={openProfileModal} patient={patient} />
          )}
        </>
      )}

      {/* ── Add modal ── */}
      <InstrumentalFindingModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        sourceText=""
        patientId={patient?.id}
        patient={patient}
        visitDate={new Date().toISOString().slice(0, 10)}
        onSaved={() => { setAddModalOpen(false); load(); }}
      />

      {/* ── Update profile from finding modal ── */}
      <FindingProfileUpdateModal
        open={profileModal.open}
        onClose={() => setProfileModal({ open: false, assessment: null })}
        assessment={profileModal.assessment}
        patient={patient}
        onUpdated={load}
      />
    </div>
  );
}
