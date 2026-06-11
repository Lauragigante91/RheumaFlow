/**
 * SpecialistVisitsSection
 *
 * Archivio visite specialistiche del paziente.
 * Vista di default: timeline cronologica unica, dalla più recente alla più vecchia.
 * Riconoscimento automatico della specialità da titolo / testo.
 * Filtri rapidi per specialità.
 * Card compatte, espandibili per testo sorgente e dettagli.
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { specialistVisitsApi } from "../../lib/api";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  Plus, ChevronDown, ChevronRight, Trash2, Pencil, Check, FileText,
  Loader2, Stethoscope,
} from "lucide-react";
import OcrScanButton from "../labs/OcrScanButton";
import { toast } from "sonner";

// ─── Specialità ───────────────────────────────────────────────────────────────
export const SPECIALTIES = [
  { key: "pneumologia",       label: "Pneumologia",       visitType: "Visita pneumologica",       color: "#0284c7", bg: "#f0f9ff", keywords: ["pneum", "respir", "polmon", "bronc", "torac"] },
  { key: "cardiologia",       label: "Cardiologia",       visitType: "Visita cardiologica",       color: "#dc2626", bg: "#fef2f2", keywords: ["cardio", "cuore", "cardiovasc", "ecocard", "ecg", "coronar"] },
  { key: "dermatologia",      label: "Dermatologia",      visitType: "Consulenza dermatologica",  color: "#d97706", bg: "#fffbeb", keywords: ["derm", "cute", "pelle", "psoriasi", "urticaria"] },
  { key: "neurologia",        label: "Neurologia",        visitType: "Consulenza neurologica",    color: "#7c3aed", bg: "#f5f3ff", keywords: ["neurol", "nerv", "encefalit", "midoll", "emg", "neuropat"] },
  { key: "nefrologia",        label: "Nefrologia",        visitType: "Consulenza nefrologica",    color: "#0f766e", bg: "#f0fdfa", keywords: ["nefrol", "renale", "rene", "glomerul", "dialisi"] },
  { key: "gastroenterologia", label: "Gastroenterologia", visitType: "Consulenza gastroenterologica", color: "#b45309", bg: "#fffbeb", keywords: ["gastro", "intestin", "colon", "esofag", "fegat", "epat", "pancr"] },
  { key: "oftalmologia",      label: "Oftalmologia",      visitType: "Visita oculistica",         color: "#0891b2", bg: "#ecfeff", keywords: ["oftalm", "ocul", "occhio", "uveit", "retina"] },
  { key: "ematologia",        label: "Ematologia",        visitType: "Consulenza ematologica",    color: "#9333ea", bg: "#faf5ff", keywords: ["emat", "sangue", "midoll", "anemia", "trombocit"] },
  { key: "endocrinologia",    label: "Endocrinologia",    visitType: "Visita endocrinologica",    color: "#0d9488", bg: "#f0fdfa", keywords: ["endocrin", "tiroide", "diabete", "ormone", "surrene"] },
  { key: "ortopedia",         label: "Ortopedia",         visitType: "Visita ortopedica",         color: "#374151", bg: "#f9fafb", keywords: ["ortop", "chirurg ortop", "protesi", "osteo", "articolar"] },
  { key: "urologia",          label: "Urologia",          visitType: "Visita urologica",          color: "#0369a1", bg: "#f0f9ff", keywords: ["urol", "vescica", "prostata", "rene"] },
  { key: "ginecologia",       label: "Ginecologia",       visitType: "Visita ginecologica",       color: "#be185d", bg: "#fff1f2", keywords: ["ginecol", "uterina", "ovarica", "ostetric"] },
  { key: "oncologia",         label: "Oncologia",         visitType: "Consulenza oncologica",     color: "#991b1b", bg: "#fef2f2", keywords: ["oncol", "neoplasia", "tumore", "carcinoma", "sarcoma", "linfoma"] },
  { key: "reumatologia",      label: "Reumatologia",      visitType: "Visita reumatologica",      color: "#6d28d9", bg: "#f5f3ff", keywords: ["reumatol", "artrite", "lupus", "fibromialg", "spondiloart", "capillar", "sclerosi sistem", "connettivite"] },
  { key: "psichiatria",       label: "Psichiatria/Psicologia", visitType: "Consulenza psichiatrica", color: "#4f46e5", bg: "#eef2ff", keywords: ["psichiat", "psicolog", "mental", "ansia", "depressione"] },
  { key: "fisiatria",         label: "Fisiatria/Fisioterapia", visitType: "Consulenza fisiatrica",   color: "#ca8a04", bg: "#fefce8", keywords: ["fisiatr", "fisioter", "riabilit"] },
  { key: "altra",             label: "Altra specialità",  visitType: "",                          color: "#6b7280", bg: "#f9fafb", keywords: [] },
];

const SPECIALTY_MAP = Object.fromEntries(SPECIALTIES.map(s => [s.key, s]));

export function detectSpecialty(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const sp of SPECIALTIES) {
    if (sp.key === "altra") continue;
    if (sp.keywords.some(kw => lower.includes(kw))) return sp.key;
  }
  return null;
}

function specialtyMeta(key) {
  return SPECIALTY_MAP[key] || SPECIALTY_MAP["altra"];
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Modale aggiungi / modifica ────────────────────────────────────────────────
export function VisitModal({ open, visit, patientId, onClose, onSaved, prefill = null }) {
  const editing = !!visit;
  const [form, setForm] = useState({
    visit_date: today(),
    visit_type: "",
    specialty: "",
    sintesi: "",
    source_text: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visit) {
      setForm({
        visit_date: visit.visit_date || today(),
        visit_type: visit.visit_type || "",
        specialty: visit.specialty || "",
        sintesi: visit.sintesi || "",
        source_text: visit.source_text || "",
      });
    } else {
      const src = prefill?.source_text || "";
      // Auto-detect specialty and visit type from source text when not explicitly provided
      const detectedSpKey  = prefill?.specialty || (src ? detectSpecialty(src) : null);
      const detectedSpMeta = detectedSpKey ? SPECIALTY_MAP[detectedSpKey] : null;
      const autoVisitType  = prefill?.visit_type || (detectedSpMeta?.visitType || "");
      setForm({
        visit_date: today(),
        visit_type: autoVisitType,
        specialty:  detectedSpKey || "",
        sintesi: "",
        source_text: src,
      });
    }
  }, [visit, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-detect specialty when visit_type or source_text changes
  const handleVisitTypeChange = (val) => {
    set("visit_type", val);
    if (!form.specialty) {
      const det = detectSpecialty(val);
      if (det) set("specialty", det);
    }
  };

  const handleSourceTextChange = (val) => {
    set("source_text", val);
    if (!form.specialty) {
      const det = detectSpecialty(val) || detectSpecialty(form.visit_type);
      if (det) set("specialty", det);
    }
  };

  const handleSave = async () => {
    if (!form.visit_date || !form.visit_type.trim()) {
      toast.error("Inserisci almeno data e tipo di visita");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        patient_id: patientId,
        visit_date: form.visit_date,
        visit_type: form.visit_type.trim(),
        specialty: form.specialty || detectSpecialty(form.visit_type) || detectSpecialty(form.source_text) || null,
        sintesi: form.sintesi.trim() || null,
        source_text: form.source_text.trim() || null,
      };
      if (editing) {
        await specialistVisitsApi.update(visit.id, payload);
        toast.success("Visita aggiornata");
      } else {
        await specialistVisitsApi.create(payload);
        toast.success("Visita specialistica salvata");
      }
      onSaved();
      onClose();
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const detectedSp = form.specialty ? specialtyMeta(form.specialty) : null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[640px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f0f9ff", border: "1px solid #bae6fd", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Stethoscope size={18} color="#0284c7" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#0A2540] leading-tight">
                {editing ? "Modifica visita" : "Nuova visita specialistica"}
              </DialogTitle>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>Inserisci i dettagli della consulenza</p>
            </div>
          </div>
        </DialogHeader>

        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Data + Tipo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Data</label>
              <input
                type="date"
                value={form.visit_date}
                onChange={e => set("visit_date", e.target.value)}
                style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tipo di visita</label>
              <input
                type="text"
                placeholder="es. Visita pneumologica, Consulenza dermatologica…"
                value={form.visit_type}
                onChange={e => handleVisitTypeChange(e.target.value)}
                style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* Sintesi */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Sintesi clinica <span style={{ fontWeight: 400, textTransform: "none" }}>(una riga — visibile nella timeline)</span>
            </label>
            <input
              type="text"
              placeholder="es. FVC 68%, quadro di fibrosi polmonare lieve-moderata. Indicata spirometria di controllo a 6 mesi."
              value={form.sintesi}
              onChange={e => set("sintesi", e.target.value)}
              style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Testo sorgente */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Testo referto / consulenza <span style={{ fontWeight: 400, textTransform: "none" }}>(facoltativo)</span>
              </label>
              <OcrScanButton
                label="Da immagine"
                onText={(text) => handleSourceTextChange(text)}
              />
            </div>
            <textarea
              placeholder="Incolla qui il testo completo della consulenza o del referto…"
              value={form.source_text}
              onChange={e => handleSourceTextChange(e.target.value)}
              rows={7}
              style={{
                width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
                padding: "10px 12px", fontSize: 12, outline: "none",
                resize: "vertical", fontFamily: "inherit", lineHeight: 1.6,
                color: "#374151", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px" }}>
            <button
              onClick={onClose}
              style={{ padding: "8px 18px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none",
                background: saving ? "#a5b4fc" : "#4f46e5",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />}
              {editing ? "Salva modifiche" : "Salva visita"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card visita ──────────────────────────────────────────────────────────────
function VisitCard({ visit, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const sp = visit.specialty ? specialtyMeta(visit.specialty) : specialtyMeta("altra");
  const hasSource = !!visit.source_text;

  return (
    <div style={{
      borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff",
      overflow: "hidden", transition: "box-shadow 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      {/* ── Compact header ── */}
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>

        {/* Left: specialty color stripe */}
        <div style={{
          width: 3, alignSelf: "stretch", borderRadius: 3, flexShrink: 0,
          background: sp.color, opacity: 0.7,
        }} />

        {/* Center: main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* Specialty badge */}
            <span style={{
              display: "inline-flex", alignItems: "center",
              padding: "2px 8px", borderRadius: "999px", fontSize: 10, fontWeight: 700,
              background: sp.bg, color: sp.color, border: `1px solid ${sp.color}33`, flexShrink: 0,
            }}>
              {sp.label}
            </span>
            {/* Date */}
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0A2540" }}>{fmtDate(visit.visit_date)}</span>
          </div>

          {/* Visit type */}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", marginTop: 3 }}>
            {visit.visit_type}
          </div>

          {/* Sintesi */}
          {visit.sintesi && (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 3, lineHeight: 1.5 }}>
              {visit.sintesi}
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
          {hasSource && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              title={expanded ? "Chiudi testo" : "Mostra testo referto"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                border: "1px solid #e5e7eb", cursor: "pointer",
                background: expanded ? "#f0f9ff" : "#f9fafb",
                color: expanded ? "#0284c7" : "#6b7280",
                transition: "all 0.1s",
              }}
            >
              <FileText size={11} />
              Testo
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          )}
          <button
            type="button" onClick={() => onEdit(visit)}
            title="Modifica"
            style={{ padding: "5px 6px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", display: "flex", color: "#6b7280" }}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button" onClick={() => onDelete(visit)}
            title="Elimina"
            style={{ padding: "5px 6px", borderRadius: 6, border: "1px solid #fee2e2", background: "#fef2f2", cursor: "pointer", display: "flex", color: "#ef4444" }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Expanded: source text ── */}
      {expanded && hasSource && (
        <div style={{
          borderTop: "1px solid #f3f4f6", margin: "0 14px", padding: "12px 0 14px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Testo originale
          </div>
          <pre style={{
            fontSize: 12, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap",
            wordBreak: "break-word", margin: 0, fontFamily: "inherit",
            background: "#f9fafb", borderRadius: 8, padding: "12px",
            border: "1px solid #f3f4f6", maxHeight: 320, overflowY: "auto",
          }}>
            {visit.source_text}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SpecialistVisitsSection({ patient }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(null); // specialty key or null = tutte
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);

  const load = useCallback(async () => {
    if (!patient?.id) return;
    setLoading(true);
    try {
      const data = await specialistVisitsApi.listByPatient(patient.id);
      setVisits(data);
    } catch {
      toast.error("Errore nel caricamento delle visite specialistiche");
    } finally {
      setLoading(false);
    }
  }, [patient?.id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (visit) => {
    if (!window.confirm(`Eliminare la visita "${visit.visit_type}" del ${fmtDate(visit.visit_date)}?`)) return;
    try {
      await specialistVisitsApi.remove(visit.id);
      setVisits(p => p.filter(v => v.id !== visit.id));
      toast.success("Visita eliminata");
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleEdit = (visit) => {
    setEditingVisit(visit);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditingVisit(null);
    setModalOpen(true);
  };

  // Specialità presenti nei dati (per i filtri rapidi)
  const presentSpecialties = useMemo(() => {
    const keys = [...new Set(visits.map(v => v.specialty).filter(Boolean))];
    return keys.map(k => specialtyMeta(k));
  }, [visits]);

  // Filtered + sorted visits
  const displayed = useMemo(() => {
    const filtered = filter ? visits.filter(v => v.specialty === filter) : visits;
    return [...filtered].sort((a, b) => (b.visit_date || "").localeCompare(a.visit_date || ""));
  }, [visits, filter]);

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {/* Filtri specialità */}
          <button
            onClick={() => setFilter(null)}
            style={{
              padding: "4px 12px", borderRadius: "999px", fontSize: 12, fontWeight: filter === null ? 700 : 500,
              border: filter === null ? "1.5px solid #4f46e5" : "1.5px solid #e5e7eb",
              background: filter === null ? "#eef2ff" : "#f9fafb",
              color: filter === null ? "#4f46e5" : "#6b7280",
              cursor: "pointer", transition: "all 0.1s",
            }}
          >
            Tutte {visits.length > 0 && `(${visits.length})`}
          </button>
          {presentSpecialties.map(sp => (
            <button
              key={sp.key}
              onClick={() => setFilter(filter === sp.key ? null : sp.key)}
              style={{
                padding: "4px 12px", borderRadius: "999px", fontSize: 12, fontWeight: filter === sp.key ? 700 : 500,
                border: filter === sp.key ? `1.5px solid ${sp.color}` : "1.5px solid #e5e7eb",
                background: filter === sp.key ? sp.bg : "#f9fafb",
                color: filter === sp.key ? sp.color : "#6b7280",
                cursor: "pointer", transition: "all 0.1s",
              }}
            >
              {sp.label} ({visits.filter(v => v.specialty === sp.key).length})
            </button>
          ))}
        </div>

        <Button onClick={handleNew} size="sm" className="h-8 text-xs gap-1.5">
          <Plus size={14} /> Nuova visita
        </Button>
      </div>

      {/* ── Timeline ── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#9ca3af", padding: "32px 0" }}>
          <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Caricamento visite…</span>
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f3f4f6", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <Stethoscope size={22} color="#9ca3af" />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>
            {filter ? `Nessuna visita di ${specialtyMeta(filter).label}` : "Nessuna visita specialistica"}
          </p>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
            {filter ? "Prova a selezionare un'altra specialità" : "Aggiungi la prima consulenza con il bottone \"Nuova visita\""}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {displayed.map(v => (
            <VisitCard key={v.id} visit={v} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      <VisitModal
        open={modalOpen}
        visit={editingVisit}
        patientId={patient?.id}
        onClose={() => { setModalOpen(false); setEditingVisit(null); }}
        onSaved={load}
      />
    </div>
  );
}
