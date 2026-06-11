/**
 * QuickTherapyModal
 *
 * Floating modal triggered when the physician selects a therapy-related phrase.
 * Three save modes:
 *   "active"             — Terapia in corso (farmaco già assunto)
 *   "today_modification" — Modifica terapeutica odierna (decisione presa oggi)
 *   "discontinued"       — Storico terapie (farmaco pregresso/sospeso)
 *
 * Left panel: drug-specific warnings (safety reminders + drug notes), collapsible.
 *
 * Props:
 *   open           boolean
 *   onClose        () => void
 *   sourceText     string   — selected text
 *   patientId      string
 *   patient        object   — full patient (optional, for pregnancy/age checks)
 *   visitDate      string   — ISO date (default: today)
 *   onSaved        (drug_name) => void
 */

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Pill, Clock, Archive, AlertCircle, ChevronLeft, ShieldAlert, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { therapiesApi } from "../../lib/api";
import { parseTherapyFromText } from "../../lib/therapyTextParser";
import ItalianDatePicker from "../shared/ItalianDatePicker";
import { detectSafetyReminders } from "../../lib/safetyReminders";
import { findDrug } from "../../lib/drugs";
import { getDrugTemplate, hasPrescriptionTemplate, buildPrescriptionExpansion, patientHasRenalImpairment } from "../../lib/prescriptionExpansion";
import { generateTimelineDates, formatScheduleForExport } from "../../lib/scheduleTimeline";
import { isSteroide, detectSteroide } from "../../lib/steroidTapering";
import SteroidTaperingModal from "./SteroidTaperingModal";
import BiologicCalendarModal from "./BiologicCalendarModal";

const CATEGORY_LABELS = {
  csDMARD: "csDMARD",
  bDMARD: "bDMARD",
  tsDMARD: "tsDMARD (JAKi)",
  glucocorticoid: "Glucocorticoide",
  NSAID: "FANS / COXIB",
  analgesic: "Analgesico",
  supportive: "Supportiva",
  other: "Altro",
};

const MODES = [
  {
    key: "active",
    icon: Pill,
    label: "Terapia in corso",
    description: "Farmaco attualmente assunto dal paziente",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#86efac",
    badgeClass: "bg-green-100 text-green-800",
  },
  {
    key: "today_modification",
    icon: Clock,
    label: "Modifica odierna",
    description: "Decisione terapeutica presa in questa visita",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fcd34d",
    badgeClass: "bg-amber-100 text-amber-800",
  },
  {
    key: "discontinued",
    icon: Archive,
    label: "Storico terapie",
    description: "Farmaco pregresso / sospeso",
    color: "#64748b",
    bg: "#f8fafc",
    border: "#cbd5e1",
    badgeClass: "bg-gray-100 text-gray-700",
  },
];

const HINT_TO_MODE = {
  active: "active",
  today_modification: "today_modification",
  discontinued: "discontinued",
  unknown: "active",
};

export default function QuickTherapyModal({
  open,
  onClose,
  sourceText = "",
  patientId,
  patient,
  visitDate,
  onSaved,
  onAppendToPlan,
  onExpand,
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [mode, setMode]     = useState("active");
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState(null);

  const [drugName,   setDrugName]   = useState("");
  const [category,   setCategory]   = useState("other");
  const [dose,       setDose]       = useState("");
  const [frequency,  setFrequency]  = useState("");
  const [route,      setRoute]      = useState("");
  const [startDate,  setStartDate]  = useState("");
  const [endDate,    setEndDate]    = useState("");
  const [discReason, setDiscReason] = useState("");
  const [notes,      setNotes]      = useState("");

  // ── Espansione prescrittiva (tutti i farmaci immunosoppressori) ────────────
  const [expandEnabled, setExpandEnabled] = useState(false);
  const [expandWeekday, setExpandWeekday] = useState("");
  const [exFlags, setExFlags] = useState({});

  // Reset expansion state when drug changes — initialise flags from template defaults
  useEffect(() => {
    setExpandEnabled(false);
    setExpandWeekday("");
    const template = getDrugTemplate(drugName);
    if (!template) { setExFlags({}); return; }
    const defaults = {};
    template.flags.forEach(f => { defaults[f.key] = f.defaultOn; });
    if (template.renalFlagKey && patientHasRenalImpairment(patient || {})) {
      defaults[template.renalFlagKey] = true;
    }
    setExFlags(defaults);
  }, [drugName]); // eslint-disable-line react-hooks/exhaustive-deps

  const expandPreview = useMemo(() => {
    if (!expandEnabled || !hasPrescriptionTemplate(drugName)) return null;
    return buildPrescriptionExpansion({
      drugName: drugName.trim(),
      dose, frequency, route,
      weekday: expandWeekday,
      exFlags,
    });
  }, [expandEnabled, drugName, dose, frequency, route, expandWeekday, exFlags]);

  // Steroid tapering
  const [showTaperingModal, setShowTaperingModal] = useState(false);

  // Biologic calendar
  const [showBiologicCalendar, setShowBiologicCalendar] = useState(false);

  // Warning panel state
  const [warnOpen,       setWarnOpen]       = useState(true);
  const [expandedWarn,   setExpandedWarn]   = useState(null);

  useEffect(() => {
    if (!open || !sourceText) return;
    const p = parseTherapyFromText(sourceText);
    setParsed(p);

    setDrugName(p.drug_name   || "");
    setCategory(p.category    || "other");
    setDose(p.dose            || "");
    setFrequency(p.frequency  || "");
    setRoute(p.route          || "");
    setStartDate(p.start_date || "");
    setEndDate(p.end_date     || "");
    setDiscReason(p.discontinuation_reason || "");
    setNotes("");
    setMode(HINT_TO_MODE[p.status_hint] || "active");
    setWarnOpen(true);
    setExpandedWarn(null);
  }, [open, sourceText]);

  // Compute safety reminders for the current drug name (live, updates as user types)
  const reminders = useMemo(() => {
    if (!drugName?.trim()) return [];
    return detectSafetyReminders([{ drug_name: drugName, status: "active" }], patient || {});
  }, [drugName, patient]);

  // Drug-specific notes from drugs.js
  const drugEntry = useMemo(() => {
    if (!drugName?.trim()) return null;
    return findDrug(drugName) || null;
  }, [drugName]);

  const drugNotes = drugEntry?.notes || null;

  // Selected regimen chip index (reset when drug changes)
  const [selectedRegIdx,   setSelectedRegIdx]   = useState(null);
  const [showTimeline,     setShowTimeline]      = useState(false);
  const [showCustomSchema, setShowCustomSchema]  = useState(false);
  useEffect(() => {
    setSelectedRegIdx(null);
    setShowTimeline(false);
    setShowCustomSchema(false);
  }, [drugName]);

  function maintenanceIntervalLabel(schedule) {
    if (!schedule?.phases) return null;
    const mPhase = schedule.phases.find(p => p.type === "maintenance");
    if (!mPhase?.interval?.days) return null;
    const d = mPhase.interval.days;
    if (d === 7)  return "settimana";
    if (d === 14) return "2 settimane";
    if (d === 21) return "3 settimane";
    if (d === 28) return "4 settimane";
    if (d === 42) return "6 settimane";
    if (d === 56) return "8 settimane";
    if (d % 28 === 0) return `${d / 28} mesi`;
    if (d % 7  === 0) return `${d / 7} settimane`;
    return `${d} giorni`;
  }

  function applyRegimen(reg) {
    setDose(reg.dose      || "");
    setFrequency(reg.frequency || "");
    setRoute(reg.route    || "");
    const parts = [];
    if (reg.loading) {
      const interval = maintenanceIntervalLabel(reg.schedule);
      parts.push(`Induzione: ${reg.loading}${interval ? `, poi ogni ${interval}` : ""}`);
    }
    if (reg.note) parts.push(reg.note);
    setNotes(parts.join("\n"));
    // Auto-open timeline if schedule present and start date already set
    if (reg.schedule) setShowTimeline(true);
  }

  // Compute timeline dates for selected regimen
  const selectedRegimen = (selectedRegIdx !== null && drugEntry?.regimens)
    ? drugEntry.regimens[selectedRegIdx]
    : null;
  const timelineDates = useMemo(() => {
    if (!selectedRegimen?.schedule || !startDate) return [];
    return generateTimelineDates(selectedRegimen.schedule, startDate);
  }, [selectedRegimen, startDate]);

  function appendScheduleToNotes() {
    if (!timelineDates.length) return;
    const text = formatScheduleForExport(timelineDates, drugName);
    if (onAppendToPlan) {
      onAppendToPlan(text);
      toast.success("Schema aggiunto a §10 – Terapia del referto");
    } else {
      // Fallback se non collegato a un piano (es. modale standalone)
      setNotes(prev => prev ? `${prev}\n\n${text}` : text);
      toast.success("Schema aggiunto alle note");
    }
  }

  const hasWarnings = reminders.length > 0 || !!drugNotes;
  const highCount   = reminders.filter(r => r.priority === "high").length;

  const currentMode = MODES.find(m => m.key === mode) || MODES[0];

  const handleSave = async () => {
    if (!drugName.trim()) {
      toast.error("Specifica il nome del farmaco");
      return;
    }
    if (!patientId) {
      toast.error("Paziente non identificato");
      return;
    }
    setSaving(true);
    try {
      const dateNow = visitDate || today;
      const payload = {
        patient_id: patientId,
        drug_name:  drugName.trim(),
        category:   category || "other",
        dose:       dose || "",
        frequency:  frequency || "",
        route:      route || "",
        start_date: startDate || (mode !== "discontinued" ? dateNow : ""),
        end_date:   mode === "discontinued" ? (endDate || "") : "",
        status:     mode === "discontinued" ? "discontinued" : "active",
        discontinuation_reason: mode === "discontinued" ? discReason : "",
        notes: buildNotes(mode, dateNow, notes, sourceText),
      };

      await therapiesApi.create(payload);

      // Prescription expansion: replace source text with generated phrase
      if (onExpand && expandEnabled && expandPreview) {
        onExpand(expandPreview);
        toast.success(`Terapia salvata e testo espanso in §10`);
      } else {
        toast.success(`"${drugName.trim()}" salvato come ${currentMode.label}`);
      }
      onSaved?.(drugName.trim());
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className={`p-0 overflow-hidden gap-0 transition-all ${
          hasWarnings && warnOpen ? "max-w-2xl" : hasWarnings ? "max-w-xl" : "max-w-lg"
        }`}
      >
        <div className="flex" style={{ maxHeight: "88vh" }}>

          {/* ── Left: warning panel ─────────────────────────────────────── */}
          {hasWarnings && (
            <div
              className={`flex-shrink-0 border-r border-amber-200 bg-gradient-to-b from-amber-50 to-orange-50/20 flex flex-col transition-all duration-200 ${
                warnOpen ? "w-64" : "w-10"
              }`}
              style={{ minHeight: 0 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-2 py-2.5 border-b border-amber-200 flex-shrink-0 gap-1">
                {warnOpen && (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 truncate">
                      Warning
                    </span>
                    {highCount > 0 && (
                      <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {highCount} critico
                      </span>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setWarnOpen(o => !o)}
                  className="p-1 rounded hover:bg-amber-100 text-amber-600 flex-shrink-0"
                  title={warnOpen ? "Nascondi warning" : "Mostra warning farmaco"}
                >
                  {warnOpen
                    ? <ChevronLeft className="w-3.5 h-3.5" />
                    : <ShieldAlert className="w-3.5 h-3.5" />
                  }
                </button>
              </div>

              {/* Body */}
              {warnOpen && (
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">

                  {/* Drug-specific note from drugs.js */}
                  {drugNotes && (
                    <div className="rounded-md border border-amber-300 bg-white/70 p-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-amber-600 mb-1">
                        Note farmaco
                      </div>
                      <p className="text-[10px] text-amber-800 leading-snug">{drugNotes}</p>
                    </div>
                  )}

                  {/* Safety reminders */}
                  {reminders.map(r => (
                    <div
                      key={r.id}
                      className={`rounded-md border p-2 cursor-pointer select-none transition-colors ${
                        r.priority === "high"
                          ? "border-red-200 bg-red-50/70 hover:bg-red-50"
                          : "border-amber-200 bg-white/60 hover:bg-amber-50/60"
                      }`}
                      onClick={() => setExpandedWarn(expandedWarn === r.id ? null : r.id)}
                    >
                      <div className="flex items-start gap-1.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[3px] ${
                            r.priority === "high" ? "bg-red-500" : "bg-amber-400"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`text-[10px] font-semibold leading-snug ${
                            r.priority === "high" ? "text-red-800" : "text-amber-800"
                          }`}>
                            {r.label}
                          </div>
                          {r.category && (
                            <div className="text-[9px] text-gray-400 mt-0.5">{r.category}</div>
                          )}
                          {expandedWarn === r.id && r.detail && (
                            <div className="text-[9.5px] text-gray-600 mt-1.5 leading-relaxed whitespace-pre-line border-t border-gray-100 pt-1.5">
                              {r.detail}
                              {r.insertionText && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNotes(prev => prev ? `${prev}\n${r.insertionText}` : r.insertionText);
                                    toast.success("Testo aggiunto alle note terapia");
                                  }}
                                  className="mt-2 block text-[9px] font-semibold text-[#0A2540] underline underline-offset-2 hover:text-blue-700 transition-colors"
                                >
                                  ↳ Inserisci in note
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {reminders.length === 0 && !drugNotes && (
                    <p className="text-[10px] text-gray-400 text-center py-4">Nessun warning specifico.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Right: form panel ────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <DialogHeader className="px-6 pt-5 pb-0 flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Pill className="w-4 h-4 text-[#0A2540]" />
                Salva terapia da testo selezionato
              </DialogTitle>
            </DialogHeader>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto px-6 pt-4 pb-2 space-y-3 min-h-0">

              {/* Source text */}
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 italic leading-snug max-h-16 overflow-y-auto">
                «{sourceText}»
              </div>

              {/* Mode selector */}
              <div className="grid grid-cols-3 gap-2">
                {MODES.map(m => {
                  const Icon = m.icon;
                  const active = mode === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => {
                        setMode(m.key);
                        if (m.key === "today_modification") setStartDate(today);
                      }}
                      className="rounded-lg border-2 p-2 text-left transition-all"
                      style={{
                        borderColor: active ? m.color : "#e5e7eb",
                        background:  active ? m.bg    : "#fff",
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon size={12} color={active ? m.color : "#9ca3af"} />
                        <span
                          className="text-[11px] font-bold leading-tight"
                          style={{ color: active ? m.color : "#6b7280" }}
                        >
                          {m.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight">{m.description}</p>
                    </button>
                  );
                })}
              </div>

              {/* Modifica odierna note */}
              {mode === "today_modification" && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 leading-snug">
                    La modifica sarà visibile come "aggiunta questa visita" — diventerà terapia in corso dalla visita successiva.
                  </p>
                </div>
              )}

              {/* Auto-parsed badge */}
              {parsed && !parsed.parsed && drugName && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] text-amber-600">Farmaco non riconosciuto automaticamente — verifica il nome.</span>
                </div>
              )}

              {/* Fields */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Farmaco *</Label>
                    <Input
                      value={drugName}
                      onChange={e => setDrugName(e.target.value)}
                      placeholder="es. Methotrexate"
                      className="text-xs h-8"
                      autoFocus
                    />
                    {isSteroide(drugName) && (
                      <button
                        type="button"
                        onClick={() => setShowTaperingModal(true)}
                        style={{
                          marginTop: "6px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          width: "100%",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1.5px dashed #f59e0b",
                          background: "#fffbeb",
                          color: "#92400e",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "background 0.12s",
                        }}
                      >
                        <span style={{ fontSize: "14px" }}>📉</span>
                        Imposta piano di scalaggio steroide
                      </button>
                    )}
                    {(category === "bDMARD" || category === "tsDMARD") && (
                      <div style={{ marginTop: "6px", display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => setShowBiologicCalendar(true)}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1.5px dashed #0ea5e9",
                            background: "#f0f9ff",
                            color: "#0c4a6e",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ fontSize: "14px" }}>💉</span>
                          Calendario somministrazioni
                        </button>
                        {drugEntry?.smpcUrl && (
                          <a
                            href={drugEntry.smpcUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Apri scheda tecnica EMA"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "6px 10px",
                              borderRadius: "8px",
                              border: "1.5px dashed #6b7280",
                              background: "#f9fafb",
                              color: "#374151",
                              fontSize: "10px",
                              fontWeight: 600,
                              cursor: "pointer",
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            <span style={{ fontSize: "13px" }}>📄</span>
                            SmPC
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Regimi suggeriti per indicazione ── */}
                {drugEntry?.regimens?.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">
                        Regimi per indicazione
                      </span>
                      <span className="text-[9px] text-gray-400">— clicca per compilare</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {drugEntry.regimens.map((reg, idx) => {
                        const isSelected = selectedRegIdx === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (selectedRegIdx === idx) {
                                setSelectedRegIdx(null);
                              } else {
                                setSelectedRegIdx(idx);
                                applyRegimen(reg);
                              }
                            }}
                            className={`rounded-md px-2 py-1 text-[10px] font-medium border transition-colors text-left ${
                              isSelected
                                ? "border-[#0A2540] bg-[#0A2540] text-white"
                                : "border-gray-200 bg-white text-gray-700 hover:border-[#0A2540]/40 hover:bg-[#0A2540]/5"
                            }`}
                          >
                            <span className="font-semibold">{reg.indication}</span>
                            <span className="mx-1 opacity-50">·</span>
                            <span>{reg.dose}</span>
                            <span className="mx-1 opacity-40">·</span>
                            <span className="opacity-80">{reg.frequency}</span>
                            {reg.route && (
                              <span className={`ml-1 ${isSelected ? "opacity-70" : "opacity-50"}`}>
                                ({reg.route})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {selectedRegIdx !== null && drugEntry.regimens[selectedRegIdx]?.note && (
                      <p className="text-[10px] text-amber-700 italic bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        {drugEntry.regimens[selectedRegIdx].note}
                      </p>
                    )}
                    {selectedRegIdx !== null && drugEntry.regimens[selectedRegIdx]?.loading && (
                      <p className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                        <span className="font-semibold">Schema induzione: </span>
                        {drugEntry.regimens[selectedRegIdx].loading}
                      </p>
                    )}
                  </div>
                )}

                {/* Campi dose/frequenza/via/categoria */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Dose</Label>
                    <Input
                      value={dose}
                      onChange={e => setDose(e.target.value)}
                      placeholder="es. 15 mg"
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Categoria</Label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Frequenza</Label>
                    <Input
                      value={frequency}
                      onChange={e => setFrequency(e.target.value)}
                      placeholder="es. Settimanale"
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Via</Label>
                    <Input
                      value={route}
                      onChange={e => setRoute(e.target.value)}
                      placeholder="es. orale, s.c."
                      className="text-xs h-8"
                    />
                  </div>
                </div>

                {/* ── Espansione prescrittiva (tutti i farmaci immunosoppressori) ── */}
                {hasPrescriptionTemplate(drugName) && (() => {
                  const template = getDrugTemplate(drugName);
                  if (!template) return null;
                  return (
                    <div className={`rounded-lg border p-3 space-y-2.5 transition-colors ${expandEnabled ? "border-blue-200 bg-blue-50/40" : "border-gray-200 bg-gray-50/60"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] ${expandEnabled ? "text-blue-700" : "text-gray-500"}`}>
                          <Sparkles className="w-3 h-3" />
                          Espansione prescrittiva
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandEnabled(v => !v)}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${expandEnabled ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}
                        >
                          {expandEnabled ? "Attiva" : "Disattivata"}
                        </button>
                      </div>

                      {expandEnabled && (
                        <>
                          {/* Weekday — solo per farmaci che lo richiedono (es. MTX) */}
                          {template.extraFields?.weekday && (
                            <div className="space-y-1">
                              <Label className="text-[10px]">Giorno di assunzione</Label>
                              <select
                                value={expandWeekday}
                                onChange={e => setExpandWeekday(e.target.value)}
                                className="w-full h-7 rounded-md border border-input bg-background px-2 text-[11px]"
                              >
                                <option value="">— non specificato —</option>
                                {["lunedì","martedì","mercoledì","giovedì","venerdì","sabato","domenica"].map(d => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Flag checkboxes dal template */}
                          <div className="space-y-1.5">
                            {template.flags.map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={exFlags[key] ?? false}
                                  onChange={() => setExFlags(f => ({ ...f, [key]: !f[key] }))}
                                  className="rounded accent-blue-600"
                                />
                                {label}
                              </label>
                            ))}
                          </div>

                          {/* Anteprima */}
                          {expandPreview && (
                            <div className="rounded-md bg-white border border-blue-200 px-2.5 py-2 text-[10.5px] text-gray-700 leading-relaxed">
                              <span className="text-[8.5px] font-bold uppercase tracking-wider text-blue-400 block mb-1">Anteprima testo generato</span>
                              {expandPreview}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Data inizio — sempre visibile (serve per il calendario) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {mode === "today_modification" ? "Data decisione" : "Data inizio"}
                    </Label>
                    <ItalianDatePicker
                      value={startDate}
                      onChange={setStartDate}
                    />
                  </div>
                </div>

                {mode === "discontinued" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Data fine / sospensione</Label>
                      <ItalianDatePicker
                        value={endDate}
                        onChange={setEndDate}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Motivo sospensione</Label>
                      <Input
                        value={discReason}
                        onChange={e => setDiscReason(e.target.value)}
                        placeholder="es. intolleranza, inefficacia, remissione…"
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                )}

                {/* Note aggiuntive */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Note aggiuntive</Label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Note cliniche opzionali…"
                    rows={2}
                    className="text-xs resize-none"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                Annulla
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !drugName.trim()}
                style={{ background: currentMode.color, color: "#fff" }}
              >
                {saving ? "Salvataggio…" : `Salva come ${currentMode.label}`}
              </Button>
            </DialogFooter>
          </div>

        </div>
      </DialogContent>
    </Dialog>

    {showTaperingModal && (
      <SteroidTaperingModal
        open={showTaperingModal}
        onClose={() => setShowTaperingModal(false)}
        initialDrug={detectSteroide(drugName)}
        initialDose={parseFloat(dose) || ""}
        visitDate={visitDate || new Date().toISOString().slice(0, 10)}
        onAppendToPlan={onAppendToPlan}
      />
    )}

    {showBiologicCalendar && (
      <BiologicCalendarModal
        open={showBiologicCalendar}
        onClose={() => setShowBiologicCalendar(false)}
        initialDrug={drugName}
        initialRegimen={selectedRegimen}
        visitDate={visitDate || new Date().toISOString().slice(0, 10)}
        onAppendToPlan={onAppendToPlan}
      />
    )}
    </>
  );
}

function buildNotes(mode, dateStr, userNotes, sourceText) {
  const parts = [];
  const dateFmt = dateStr
    ? new Date(dateStr).toLocaleDateString("it-IT")
    : "";

  if (mode === "today_modification") {
    parts.push(`[Decisione terapeutica visita del ${dateFmt}]`);
  }
  if (sourceText?.trim()) {
    parts.push(`Fonte: «${sourceText.slice(0, 120)}${sourceText.length > 120 ? "…" : ""}»`);
  }
  if (userNotes?.trim()) parts.push(userNotes.trim());
  return parts.join("\n");
}
